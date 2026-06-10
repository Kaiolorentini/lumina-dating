// ============================================
// ASAAS WEBHOOK — FASE 6B
//
// Validação de token obrigatória.
// Idempotente: verifica sale.status antes.
// Salva lastWebhookEvent + lastWebhookAt.
// ============================================

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { createAuditLog } from "../utils/auditLog";
import { incrementMetrics } from "../utils/incrementMetric";

export const onAsaasWebhook = onRequest(
  {
    secrets: ["ASAAS_WEBHOOK_TOKEN"],
  },
  async (req, res) => {
    // ============================================
    // Validações de entrada
    // ============================================
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const token = req.headers["asaas-access-token"] as string;
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN!;

    if (!token) {
      console.warn("[onAsaasWebhook] Token ausente");
      res.status(401).send("Unauthorized");
      return;
    }

    if (token !== expectedToken) {
      console.warn("[onAsaasWebhook] Token inválido");
      res.status(401).send("Unauthorized");
      return;
    }

    const event = req.body;
    const payment = event?.payment;
    const eventType = event?.event as string;

    if (!payment?.externalReference) {
      res.status(200).send("OK — sem referência");
      return;
    }

    const saleId = payment.externalReference as string;
    const db = admin.firestore();

    try {
      const saleRef = db.collection("sales").doc(saleId);
      const saleSnap = await saleRef.get();

      if (!saleSnap.exists) {
        console.warn(`[onAsaasWebhook] Sale ${saleId} não encontrada`);
        res.status(200).send("OK");
        return;
      }

      const sale = saleSnap.data()!;

      // ============================================
      // IDEMPOTÊNCIA — já processado
      // ============================================
      if (sale.status === "paid") {
        console.log(`[onAsaasWebhook] Sale ${saleId} já processada — ignorando`);
        res.status(200).send("OK — já processado");
        return;
      }

      // ============================================
      // PAYMENT_RECEIVED | PAYMENT_CONFIRMED
      // ============================================
      if (eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
        await db.runTransaction(async (tx) => {
          const saleDoc = await tx.get(saleRef);
          if (saleDoc.data()?.status === "paid") return; // double-check

          const saleData = saleDoc.data()!;
          const purchaseId = saleData.purchaseId ?? `${saleData.buyerId}_${saleData.productId}`;
          const purchaseRef = db.collection("purchases").doc(purchaseId);
          const walletRef = db.collection("creatorWallets").doc(saleData.sellerId);
          const walletSnap = await tx.get(walletRef);

          const refundWindowExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

          tx.update(saleRef, {
            status: "paid",
            paymentStatus: "received",
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastWebhookEvent: eventType,
            lastWebhookAt: admin.firestore.FieldValue.serverTimestamp(),
            refundWindowExpiresAt: admin.firestore.Timestamp.fromDate(refundWindowExpires),
          });

          tx.set(purchaseRef, {
            buyerId: saleData.buyerId,
            sellerId: saleData.sellerId,
            productId: saleData.productId,
            saleId,
            amount: saleData.amount,
            status: "active",
            isRevoked: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          if (walletSnap.exists) {
            tx.update(walletRef, {
              pendingBalance: admin.firestore.FieldValue.increment(saleData.sellerAmount),
              totalEarned: admin.firestore.FieldValue.increment(saleData.sellerAmount),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          } else {
            tx.set(walletRef, {
              userId: saleData.sellerId,
              availableBalance: 0,
              pendingBalance: saleData.sellerAmount,
              totalEarned: saleData.sellerAmount,
              totalWithdrawn: 0,
              hasChargebackPending: false,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          const txRef = db.collection("creatorTransactions").doc();
          tx.set(txRef, {
            userId: saleData.sellerId,
            type: "sale",
            amount: saleData.sellerAmount,
            description: `Venda: ${saleData.productId}`,
            saleId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        await incrementMetrics({
          totalSales: 1,
          totalCommission: sale.platformCommission,
          totalProductsSold: 1,
          todaySales: 1,
          todayRevenue: sale.amount,
          monthlyRevenue: sale.amount,
          monthlyCommission: sale.platformCommission,
        });

        await createAuditLog({
          action: "payment_received",
          performedBy: "asaas-webhook",
          targetId: saleId,
          targetType: "sale",
          metadata: { eventType, amount: sale.amount, paymentId: payment.id },
          req,
        });
      }

      // ============================================
      // PAYMENT_OVERDUE
      // ============================================
      if (eventType === "PAYMENT_OVERDUE") {
        await saleRef.update({
          paymentStatus: "overdue",
          lastWebhookEvent: eventType,
          lastWebhookAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // ============================================
      // PAYMENT_CANCELLED
      // ============================================
      if (eventType === "PAYMENT_CANCELLED") {
        await saleRef.update({
          status: "refunded",
          paymentStatus: "cancelled",
          lastWebhookEvent: eventType,
          lastWebhookAt: admin.firestore.FieldValue.serverTimestamp(),
          webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // ============================================
      // CHARGEBACK_REQUESTED
      // ============================================
      if (eventType === "CHARGEBACK_REQUESTED") {
        await db.runTransaction(async (tx) => {
          const saleDoc = await tx.get(saleRef);
          const saleData = saleDoc.data()!;

          if (saleData.isChargebacked) return;

          const purchaseId = saleData.purchaseId ?? `${saleData.buyerId}_${saleData.productId}`;
          const purchaseRef = db.collection("purchases").doc(purchaseId);
          const walletRef = db.collection("creatorWallets").doc(saleData.sellerId);
          const walletSnap = await tx.get(walletRef);
          const wallet = walletSnap.data();

          tx.update(saleRef, {
            isChargebacked: true,
            chargebackedAt: admin.firestore.FieldValue.serverTimestamp(),
            paymentStatus: "refunded",
            lastWebhookEvent: eventType,
            lastWebhookAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          tx.update(purchaseRef, {
            status: "revoked",
            isRevoked: true,
          });

          if (wallet) {
            const fromPending = Math.min(wallet.pendingBalance ?? 0, saleData.sellerAmount);
            const fromAvailable = Math.min(
              wallet.availableBalance ?? 0,
              saleData.sellerAmount - fromPending
            );

            tx.update(walletRef, {
              hasChargebackPending: true,
              pendingBalance: admin.firestore.FieldValue.increment(-fromPending),
              availableBalance: admin.firestore.FieldValue.increment(-fromAvailable),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        });

        await createAuditLog({
          action: "chargeback_received",
          performedBy: "asaas-webhook",
          targetId: saleId,
          targetType: "sale",
          metadata: { eventType, paymentId: payment.id },
          req,
        });
      }

      // ============================================
      // CHARGEBACK_DISPUTE | CHARGEBACK_REVERSED
      // ============================================
      if (eventType === "CHARGEBACK_DISPUTE" || eventType === "CHARGEBACK_REVERSED") {
        await saleRef.update({
          lastWebhookEvent: eventType,
          lastWebhookAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await createAuditLog({
          action: eventType.toLowerCase(),
          performedBy: "asaas-webhook",
          targetId: saleId,
          targetType: "sale",
          metadata: { eventType },
          req,
        });
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("[onAsaasWebhook] Erro:", error);
      res.status(500).send("Internal Error");
    }
  }
);
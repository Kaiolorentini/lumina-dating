// ============================================
// ASAAS WEBHOOK — FASE 6B
//
// ⚠️ API_TODO #4 — Ativar quando tiver:
// - ASAAS_WEBHOOK_TOKEN configurado no Secret Manager
// - ASAAS_API_KEY configurado no Secret Manager
// - Webhook configurado no painel Asaas com a URL:
//   https://us-central1-lumina-ff667.cloudfunctions.net/onAsaasWebhook
//
// Por enquanto retorna 200 sem processar.
// ============================================

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { createAuditLog } from "../utils/auditLog";
import { incrementMetrics } from "../utils/incrementMetric";

export const onAsaasWebhook = onRequest(
  {
    // API_TODO #5: descomentar quando secrets estiverem configurados
    // secrets: ["ASAAS_WEBHOOK_TOKEN"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // ============================================
    // API_TODO #6 — Validar token do webhook
    // Descomentar quando ASAAS_WEBHOOK_TOKEN estiver configurado:
    //
    // const token = req.headers["asaas-access-token"] as string;
    // const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN!;
    // if (!token || token !== expectedToken) {
    //   console.warn("[onAsaasWebhook] Token inválido");
    //   res.status(401).send("Unauthorized");
    //   return;
    // }
    // ============================================

    const event = req.body;
    const payment = event?.payment;

    if (!payment?.externalReference) {
      res.status(200).send("OK — sem referência");
      return;
    }

    const saleId = payment.externalReference as string;
    const eventType = event.event as string;
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

      // IDEMPOTÊNCIA
      if (sale.webhookProcessedAt) {
        console.log(`[onAsaasWebhook] Sale ${saleId} já processada`);
        res.status(200).send("OK — já processado");
        return;
      }

      if (eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
        await db.runTransaction(async (tx) => {
          const saleDoc = await tx.get(saleRef);
          if (saleDoc.data()?.webhookProcessedAt) return; // double-check

          const saleData = saleDoc.data()!;
          const purchaseId = saleData.purchaseId ?? `${saleData.buyerId}_${saleData.productId}`;
          const purchaseRef = db.collection("purchases").doc(purchaseId);
          const walletRef = db.collection("creatorWallets").doc(saleData.sellerId);
          const walletSnap = await tx.get(walletRef);

          // Calcula janela de reembolso (24h)
          const refundWindowExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

          tx.update(saleRef, {
            status: "paid",
            paymentStatus: "received",
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
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
          metadata: { eventType, amount: sale.amount },
          req,
        });
      }

      if (eventType === "PAYMENT_OVERDUE") {
        await saleRef.update({
          paymentStatus: "overdue",
          webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (eventType === "PAYMENT_CANCELLED") {
        await saleRef.update({
          status: "refunded",
          paymentStatus: "cancelled",
          webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (eventType === "CHARGEBACK_REQUESTED") {
        await db.runTransaction(async (tx) => {
          const saleDoc = await tx.get(saleRef);
          const saleData = saleDoc.data()!;

          // Proteção contra chargeback duplo
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
          });

          tx.update(purchaseRef, {
            status: "revoked",
            isRevoked: true,
          });

          if (wallet) {
            const fromPending = Math.min(wallet.pendingBalance ?? 0, saleData.sellerAmount);
            const fromAvailable = saleData.sellerAmount - fromPending;
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
// ============================================
// APPROVE REFUND — FASE 6B HARDENING
//
// Adição: validar sale.status === 'paid'
// antes de chamar Asaas.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";
import { refundPayment } from "../utils/asaasClient";

export const approveRefund = onCall(
  {
    secrets: ["ASAAS_API_KEY", "ASAAS_ENVIRONMENT"],
  },
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const safeUid: string = request.auth!.uid;

    await assertSuperAdmin(safeUid);
    await assertUserNotBlocked(safeUid);

    const { refundRequestId } = request.data as { refundRequestId: string };
    if (!refundRequestId) {
      throw new HttpsError("invalid-argument", "refundRequestId obrigatório");
    }

    const db = admin.firestore();
    const refundRef = db.collection("refundRequests").doc(refundRequestId);
    const refundSnap = await refundRef.get();

    if (!refundSnap.exists) {
      throw new HttpsError("not-found", "Solicitação não encontrada");
    }

    const refund = refundSnap.data()!;

    if (refund.status !== "pending") {
      throw new HttpsError("failed-precondition", "Solicitação já foi processada");
    }

    const saleRef = db.collection("sales").doc(refund.saleId);
    const saleSnap = await saleRef.get();

    if (!saleSnap.exists) {
      throw new HttpsError("not-found", "Venda não encontrada");
    }

    const sale = saleSnap.data()!;

    // ============================================
    // CORREÇÃO 3 — Apenas vendas pagas podem
    // ser reembolsadas via Asaas
    // ============================================
    if (sale.status !== "paid") {
      throw new HttpsError(
        "failed-precondition",
        `Reembolso permitido apenas para vendas pagas. Status atual: ${sale.status}`
      );
    }

    // ============================================
    // Validar prazo de 48h
    // ============================================
    const saleCreatedAt = sale.createdAt?.toDate?.() ?? new Date(0);
    const horasDesdeCompra = (Date.now() - saleCreatedAt.getTime()) / (1000 * 60 * 60);

    if (horasDesdeCompra > 48) {
      throw new HttpsError(
        "failed-precondition",
        "Prazo de reembolso expirado. A venda tem mais de 48 horas."
      );
    }

    if (!sale.paymentId) {
      throw new HttpsError(
        "failed-precondition",
        "Venda sem paymentId — não pode ser reembolsada via Asaas"
      );
    }

    // ============================================
    // Chamar API Asaas para estorno
    // ============================================
    await refundPayment(sale.paymentId);

    // ============================================
    // Transaction — nunca ir negativo
    // ============================================
    await db.runTransaction(async (tx) => {
      const walletRef = db.collection("creatorWallets").doc(sale.sellerId);
      const walletSnap = await tx.get(walletRef);
      const wallet = walletSnap.data();

      tx.update(refundRef, {
        status: "approved",
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedBy: safeUid,
      });

      tx.update(saleRef, {
        status: "refunded",
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastWebhookEvent: "refund_approved_admin",
        lastWebhookAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const purchaseRef = db.collection("purchases").doc(refund.purchaseId);
      tx.update(purchaseRef, {
        status: "refunded",
        isRevoked: true,
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (wallet) {
        const fromPending = Math.min(wallet.pendingBalance ?? 0, sale.sellerAmount);
        const remainingDebt = sale.sellerAmount - fromPending;
        const fromAvailable = Math.min(wallet.availableBalance ?? 0, remainingDebt);

        tx.update(walletRef, {
          pendingBalance: admin.firestore.FieldValue.increment(-fromPending),
          availableBalance: admin.firestore.FieldValue.increment(-fromAvailable),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      const txRef = db.collection("creatorTransactions").doc();
      tx.set(txRef, {
        userId: sale.sellerId,
        type: "refund",
        amount: -sale.sellerAmount,
        description: `Reembolso aprovado: ${sale.productId}`,
        saleId: refund.saleId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await createAuditLog({
      action: "refund_approved",
      performedBy: safeUid,
      targetId: refundRequestId,
      targetType: "sale",
      metadata: {
        saleId: refund.saleId,
        amount: refund.amount,
        buyerId: refund.buyerId,
        asaasPaymentId: sale.paymentId,
      },
      req: request.rawRequest,
    });

    return { success: true };
  }
);
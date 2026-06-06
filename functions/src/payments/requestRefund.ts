// ============================================
// REQUEST REFUND — POLÍTICA SIMPLIFICADA MVP
//
// Comprador solicita reembolso em até 24h após pagamento.
// Admin tem 24h para aprovar ou rejeitar manualmente.
// NÃO há reembolso automático.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";

const REFUND_WINDOW_HOURS = 24;
const ADMIN_REVIEW_HOURS = 24;

export const requestRefund = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Não autenticado");

  await assertUserNotBlocked(uid);

  const { saleId, reason } = request.data as {
    saleId: string;
    reason: string;
  };

  if (!saleId) throw new HttpsError("invalid-argument", "saleId obrigatório");
  if (!reason?.trim()) throw new HttpsError("invalid-argument", "Informe o motivo do reembolso");

  const db = admin.firestore();
  const saleRef = db.collection("sales").doc(saleId);
  const saleSnap = await saleRef.get();

  if (!saleSnap.exists) throw new HttpsError("not-found", "Venda não encontrada");

  const sale = saleSnap.data()!;

  // Valida que é o comprador
  if (sale.buyerId !== uid) {
    throw new HttpsError("permission-denied", "Sem permissão para solicitar reembolso desta venda");
  }

  // Valida status da venda
  if (sale.status !== "paid") {
    throw new HttpsError("failed-precondition", "Apenas vendas pagas podem ser reembolsadas");
  }

  // Valida janela de 24h
  const paidAt = sale.paidAt?.toDate() ?? sale.createdAt?.toDate();
  if (!paidAt) throw new HttpsError("internal", "Data de pagamento não encontrada");

  const refundWindowExpires = new Date(paidAt.getTime() + REFUND_WINDOW_HOURS * 60 * 60 * 1000);
  const now = new Date();

  if (now > refundWindowExpires) {
    throw new HttpsError(
      "failed-precondition",
      `O prazo para solicitar reembolso expirou. Você tinha ${REFUND_WINDOW_HOURS}h após o pagamento.`
    );
  }

  // Verifica se já existe refundRequest ativo para esta venda
  const existingRefund = await db.collection("refundRequests")
    .where("saleId", "==", saleId)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  if (!existingRefund.empty) {
    throw new HttpsError("already-exists", "Já existe uma solicitação de reembolso pendente para esta venda");
  }

  const purchaseId = sale.purchaseId ?? `${uid}_${sale.productId}`;
  const adminReviewExpires = new Date(now.getTime() + ADMIN_REVIEW_HOURS * 60 * 60 * 1000);

  await db.runTransaction(async (tx) => {
    // Cria refundRequest
    const refundRef = db.collection("refundRequests").doc();
    tx.set(refundRef, {
      saleId,
      purchaseId,
      buyerId: uid,
      sellerId: sale.sellerId,
      productId: sale.productId,
      amount: sale.amount,
      sellerAmount: sale.sellerAmount,
      reason: reason.trim(),
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(adminReviewExpires),
    });

    // Atualiza status da sale
    tx.update(saleRef, {
      status: "refund_requested",
      refundRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
      refundWindowExpiresAt: admin.firestore.Timestamp.fromDate(refundWindowExpires),
    });
  });

  await createAuditLog({
    action: "refund_requested",
    performedBy: uid,
    targetId: saleId,
    targetType: "sale",
    metadata: { reason, productId: sale.productId, amount: sale.amount },
    req: request.rawRequest,
  });

  return { success: true };
});

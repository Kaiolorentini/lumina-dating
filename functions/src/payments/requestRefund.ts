// ============================================
// REQUEST REFUND v2 — direito de arrependimento (7 dias)
// functions/src/payments/requestRefund.ts
//
// v2 (28/09):
// - Prazo de 7 DIAS após o pagamento (CDC art. 49). Era 24h.
// - O comprador informa a CHAVE PIX para receber: o estorno é
//   MANUAL — o admin aprova e transfere pelo banco
//   (approveRefund → markRefundPaid).
// - Só pelo servidor: a criação direta pelo app está fechada nas rules.
// - Cristais e produto gratuito não entram (sem valor a devolver
//   por aqui).
// 3+ pedidos em 30 dias continua gerando fraudFlag (abuse).
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { assertUserNotBlocked } from '../utils/assertUserNotBlocked';
import { createAuditLog } from '../utils/auditLog';
import { createFraudFlag } from '../utils/createFraudFlag';
import { notifyAdmins } from '../utils/notifyAdmins';
import { parsePixKey } from '../utils/pixKey';

const REFUND_WINDOW_DAYS = 7;
const ABUSE_THRESHOLD    = 3;
const ABUSE_WINDOW_DAYS  = 30;
const MAX_REASON         = 300;

export const requestRefund = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado');

  await assertUserNotBlocked(uid);

  const { saleId, reason, pixKey, pixKeyType } = (request.data ?? {}) as {
    saleId?: unknown; reason?: unknown; pixKey?: unknown; pixKeyType?: unknown;
  };

  if (typeof saleId !== 'string' || !saleId || saleId.includes('/')) {
    throw new HttpsError('invalid-argument', 'saleId obrigatório');
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new HttpsError('invalid-argument', 'Informe o motivo do reembolso');
  }
  const cleanReason = reason.trim().slice(0, MAX_REASON);
  const key = parsePixKey(pixKeyType, pixKey);

  const db      = admin.firestore();
  const saleRef = db.collection('sales').doc(saleId);
  const sale    = (await saleRef.get()).data();

  if (!sale) throw new HttpsError('not-found', 'Venda não encontrada');
  if (sale.buyerId !== uid) {
    throw new HttpsError('permission-denied', 'Sem permissão para solicitar reembolso desta venda');
  }
  if (sale.type === 'coins_purchase') {
    throw new HttpsError('failed-precondition', 'Compras de cristais não são reembolsáveis por aqui.');
  }
  if (!(Number(sale.amount) > 0)) {
    throw new HttpsError('failed-precondition', 'Produtos gratuitos não têm valor a reembolsar.');
  }
  if (sale.status !== 'paid') {
    throw new HttpsError('failed-precondition', 'Apenas compras pagas podem ser reembolsadas.');
  }

  const paidAt = sale.paidAt?.toDate?.() ?? sale.createdAt?.toDate?.();
  if (!paidAt) throw new HttpsError('internal', 'Data de pagamento não encontrada');

  const windowEnds = new Date(paidAt.getTime() + REFUND_WINDOW_DAYS * 24 * 3600 * 1000);
  if (Date.now() > windowEnds.getTime()) {
    throw new HttpsError(
      'failed-precondition',
      `O prazo para pedir reembolso terminou. São ${REFUND_WINDOW_DAYS} dias após o pagamento.`,
    );
  }

  const refundRef = db.collection('refundRequests').doc();

  await db.runTransaction(async (tx) => {
    // Re-lê a venda: dois toques simultâneos não criam dois pedidos.
    const fresh = (await tx.get(saleRef)).data();
    if (fresh?.status !== 'paid') {
      throw new HttpsError('already-exists', 'Já existe um pedido de reembolso para esta compra.');
    }

    tx.set(refundRef, {
      saleId,
      purchaseId:      sale.purchaseId ?? `${uid}_${sale.productId}`,
      buyerId:         uid,
      sellerId:        sale.sellerId,
      productId:       sale.productId,
      amount:          Number(sale.amount),
      sellerAmount:    Number(sale.sellerAmount ?? 0),
      reason:          cleanReason,
      buyerPixKey:     key.pixKey,
      buyerPixKeyType: key.pixKeyType,
      status:          'pending',
      refundWindowEndsAt: admin.firestore.Timestamp.fromDate(windowEnds),
      createdAt:       FieldValue.serverTimestamp(),
    });

    tx.update(saleRef, {
      status:                'refund_requested',
      refundRequestedAt:     FieldValue.serverTimestamp(),
      refundWindowExpiresAt: admin.firestore.Timestamp.fromDate(windowEnds),
    });
  });

  await createAuditLog({
    action: 'refund_requested',
    performedBy: uid,
    targetId: saleId,
    targetType: 'sale',
    // Sem a chave Pix no log.
    metadata: { reason: cleanReason, productId: sale.productId, amount: sale.amount },
    req: request.rawRequest,
  });

  notifyAdmins({
    title: '↩️ Novo pedido de reembolso',
    body:  `R$ ${Number(sale.amount).toFixed(2)} — ${cleanReason}`,
    type:  'refund_requested',
    data:  { saleId, productId: sale.productId ?? '' },
  }).catch(() => {});

  try {
    const windowStart = new Date(Date.now() - ABUSE_WINDOW_DAYS * 24 * 3600 * 1000);
    const recent = await db.collection('refundRequests')
      .where('buyerId', '==', uid)
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(windowStart))
      .get();
    if (recent.size >= ABUSE_THRESHOLD) {
      createFraudFlag({
        userId: uid,
        reason: 'abuse',
        description: `Usuário solicitou ${recent.size} reembolsos nos últimos ${ABUSE_WINDOW_DAYS} dias`,
        relatedSaleId: saleId,
      }).catch(() => {});
    }
  } catch (error) {
    console.warn('[requestRefund] erro verificando abuso:', error);
  }

  return { success: true, refundRequestId: refundRef.id };
});
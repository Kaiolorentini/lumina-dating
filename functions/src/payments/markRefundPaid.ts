// ============================================
// LUMINA — REEMBOLSO PAGO (manual, superadmin)
// functions/src/payments/markRefundPaid.ts
//
// Depois de transferir o Pix ao comprador, o admin marca o pedido
// como pago. Só a partir de 'approved'.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { assertAuthenticated, assertSuperAdmin } from '../utils/adminGuard';
import { createAuditLog } from '../utils/auditLog';
import { notifyUser } from '../utils/notifyUser';

export const markRefundPaid = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const adminUid: string = request.auth!.uid;
  await assertSuperAdmin(adminUid);

  const { refundRequestId } = (request.data ?? {}) as { refundRequestId?: unknown };
  if (typeof refundRequestId !== 'string' || !refundRequestId || refundRequestId.includes('/')) {
    throw new HttpsError('invalid-argument', 'refundRequestId obrigatório');
  }

  const db        = admin.firestore();
  const refundRef = db.collection('refundRequests').doc(refundRequestId);

  const refund = await db.runTransaction(async (tx) => {
    const snap = await tx.get(refundRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Solicitação não encontrada');
    const data = snap.data()!;
    if (data.status !== 'approved') {
      throw new HttpsError('failed-precondition', 'O reembolso precisa estar aprovado antes de ser pago.');
    }
    tx.update(refundRef, {
      status: 'paid',
      paidAt: FieldValue.serverTimestamp(),
      paidBy: adminUid,
    });
    return data;
  });

  await createAuditLog({
    action: 'refund_paid',
    performedBy: adminUid,
    targetId: refundRequestId,
    targetType: 'sale',
    metadata: { saleId: refund.saleId, amount: refund.amount },
    req: request.rawRequest,
  });

  notifyUser({
    userId: refund.buyerId,
    title:  '✅ Reembolso pago',
    body:   `R$ ${Number(refund.amount ?? 0).toFixed(2)} foram enviados para a sua chave Pix.`,
    type:   'refund_processed',
  }).catch(() => {});

  return { success: true };
});
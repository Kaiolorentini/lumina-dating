// ============================================
// REJECT REFUND v2
// functions/src/payments/rejectRefund.ts
//
// v2 (28/09):
// - Avisa o comprador (antes ele não sabia da rejeição).
// - A venda só volta a 'paid' se ainda estiver 'refund_requested':
//   se o banco estornou no meio-tempo, ela fica como está.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { assertAuthenticated, assertSuperAdmin } from '../utils/adminGuard';
import { createAuditLog } from '../utils/auditLog';
import { notifyUser } from '../utils/notifyUser';

const MAX_REASON = 300;

export const rejectRefund = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const adminUid: string = request.auth!.uid;
  await assertSuperAdmin(adminUid);

  const { refundRequestId, reason } = (request.data ?? {}) as { refundRequestId?: unknown; reason?: unknown };
  if (typeof refundRequestId !== 'string' || !refundRequestId || refundRequestId.includes('/')) {
    throw new HttpsError('invalid-argument', 'refundRequestId obrigatório');
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new HttpsError('invalid-argument', 'Informe o motivo da rejeição');
  }
  const cleanReason = reason.trim().slice(0, MAX_REASON);

  const db        = admin.firestore();
  const refundRef = db.collection('refundRequests').doc(refundRequestId);

  const refund = await db.runTransaction(async (tx) => {
    const refundSnap = await tx.get(refundRef);
    if (!refundSnap.exists) throw new HttpsError('not-found', 'Solicitação de reembolso não encontrada');
    const data = refundSnap.data()!;
    if (data.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Solicitação já foi processada');
    }

    const saleRef  = db.collection('sales').doc(data.saleId);
    const saleSnap = await tx.get(saleRef);

    tx.update(refundRef, {
      status:          'rejected',
      rejectionReason: cleanReason,
      reviewedAt:      FieldValue.serverTimestamp(),
      reviewedBy:      adminUid,
    });

    if (saleSnap.data()?.status === 'refund_requested') {
      tx.update(saleRef, {
        status:            'paid',
        refundRequestedAt: FieldValue.delete(),
      });
    }

    return data;
  });

  await createAuditLog({
    action: 'refund_rejected',
    performedBy: adminUid,
    targetId: refundRequestId,
    targetType: 'sale',
    metadata: { saleId: refund.saleId, reason: cleanReason },
    req: request.rawRequest,
  });

  notifyUser({
    userId: refund.buyerId,
    title:  'Pedido de reembolso não aprovado',
    body:   `Motivo: ${cleanReason}`,
    type:   'refund_processed',
  }).catch(() => {});

  return { success: true };
});
// ============================================
// APPROVE REFUND v2 — reembolso manual por Pix
// functions/src/payments/approveRefund.ts
//
// v2 (28/09): SEM chamada ao Asaas. O estorno é feito pelo admin, por
// Pix, para a chave que o comprador informou. Esta função:
//   1. revoga a compra (o conteúdo sai da biblioteca);
//   2. marca a venda como reembolsada;
//   3. desconta os 80% do criador — o que faltar vira DÍVIDA;
//   4. deixa o pedido em 'approved' (aguardando o Pix).
// Depois de transferir, o admin chama markRefundPaid.
//
// (A v1 procurava sale.paymentId, campo que as vendas não têm —
// asaasPaymentId — e todo reembolso aprovado falhava.)
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { assertAuthenticated, assertSuperAdmin } from '../utils/adminGuard';
import { createAuditLog } from '../utils/auditLog';
import { notifyUser } from '../utils/notifyUser';
import { incrementMetrics } from '../utils/incrementMetric';
import { debitCreator, round2 } from '../utils/creatorLedger';

export const approveRefund = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const adminUid: string = request.auth!.uid;
  await assertSuperAdmin(adminUid);

  const { refundRequestId } = (request.data ?? {}) as { refundRequestId?: unknown };
  if (typeof refundRequestId !== 'string' || !refundRequestId || refundRequestId.includes('/')) {
    throw new HttpsError('invalid-argument', 'refundRequestId obrigatório');
  }

  const db        = admin.firestore();
  const refundRef = db.collection('refundRequests').doc(refundRequestId);

  const result = await db.runTransaction(async (tx) => {
    const refundSnap = await tx.get(refundRef);
    if (!refundSnap.exists) throw new HttpsError('not-found', 'Solicitação não encontrada');
    const refund = refundSnap.data()!;
    if (refund.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Solicitação já foi processada');
    }

    const saleRef     = db.collection('sales').doc(refund.saleId);
    const walletRef   = db.collection('creatorWallets').doc(refund.sellerId);
    const purchaseRef = db.collection('purchases').doc(refund.purchaseId);

    const [saleSnap, walletSnap, purchaseSnap] = await Promise.all([
      tx.get(saleRef), tx.get(walletRef), tx.get(purchaseRef),
    ]);

    const sale = saleSnap.data();
    if (!sale) throw new HttpsError('not-found', 'Venda não encontrada');
    // Estornada pelo banco enquanto o pedido esperava: não desconta de novo.
    if (sale.status !== 'refund_requested') {
      throw new HttpsError(
        'failed-precondition',
        `A venda está como "${sale.status}". Rejeite este pedido — o valor já foi tratado.`,
      );
    }

    const amount       = round2(Number(sale.amount ?? 0));
    const sellerAmount = round2(Number(sale.sellerAmount ?? 0));

    tx.update(refundRef, {
      status:     'approved',
      approvedAt: FieldValue.serverTimestamp(),
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: adminUid,
    });

    tx.update(saleRef, {
      status:     'refunded',
      refundedAt: FieldValue.serverTimestamp(),
      updatedAt:  FieldValue.serverTimestamp(),
    });

    if (purchaseSnap.exists) {
      tx.update(purchaseRef, {
        status:     'refunded',
        isRevoked:  true,
        refundedAt: FieldValue.serverTimestamp(),
      });
    }

    const debit = debitCreator(tx, walletRef, walletSnap.data() ?? {}, sellerAmount, {
      userId:      refund.sellerId,
      type:        'refund',
      description: 'Reembolso aprovado',
      saleId:      refund.saleId,
    });

    return {
      buyerId:  refund.buyerId as string,
      sellerId: refund.sellerId as string,
      saleId:   refund.saleId as string,
      amount,
      sellerAmount,
      debtCreated: debit.debtCreated,
    };
  });

  incrementMetrics({
    totalRefunds:           1,
    monthlyRefundsApproved: 1,
    monthlyRefundedAmount:  result.amount,
  }).catch(() => {});

  await createAuditLog({
    action: 'refund_approved',
    performedBy: adminUid,
    targetId: refundRequestId,
    targetType: 'sale',
    metadata: { saleId: result.saleId, amount: result.amount, debtCreated: result.debtCreated },
    req: request.rawRequest,
  });

  notifyUser({
    userId: result.buyerId,
    title:  '↩️ Reembolso aprovado',
    body:   `Vamos enviar R$ ${result.amount.toFixed(2)} para a chave Pix que você informou. Avisamos quando o pagamento for feito.`,
    type:   'refund_processed',
  }).catch(() => {});

  notifyUser({
    userId: result.sellerId,
    title:  '↩️ Uma venda foi reembolsada',
    body:   result.debtCreated > 0
      ? `R$ ${result.sellerAmount.toFixed(2)} foram descontados. R$ ${result.debtCreated.toFixed(2)} ficaram como pendência, coberta pelas próximas vendas.`
      : `R$ ${result.sellerAmount.toFixed(2)} foram descontados do seu saldo.`,
    // Tipo próprio: 'refund_processed' é do comprador e acenderia o
    // balão de Minhas Compras do criador.
    type:   'sale_refunded',
  }).catch(() => {});

  return { success: true, debtCreated: result.debtCreated };
});
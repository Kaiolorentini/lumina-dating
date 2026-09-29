// ============================================
// LUMINA — PAINEL ADMIN (pendentes + métricas)
// functions/src/admin/getAdminDashboard.ts
//
// PENDENTES são CONTADOS nas coleções (count(), cobrado como leitura
// de índice), nunca mantidos à mão: contador manual desalinha, e
// pendingProducts/pendingWithdrawals nunca foram gravados por
// ninguém. Os mesmos números alimentam os balões das áreas e da aba.
//
// Fraudes contam 'open' (createFraudFlag) E 'pending'
// (handleCoinsChargeback) — os dois caminhos gravam status diferentes.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { assertAuthenticated } from '../utils/adminGuard';
import { todayBr } from '../utils/dateBr';

const ADMIN_ROLES = new Set(['admin', 'superadmin']);

async function count(q: FirebaseFirestore.Query): Promise<number> {
  return (await q.count().get()).data().count;
}

export const getAdminDashboard = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const db   = admin.firestore();
  const role = (await db.collection('users').doc(request.auth!.uid).get()).data()?.role;
  if (!ADMIN_ROLES.has(role)) throw new HttpsError('permission-denied', 'Acesso restrito.');

  const monthStart = new Date(`${todayBr().slice(0, 7)}-01T00:00:00-03:00`);

  const [
    ageVerifications, creatorRequests, products, withdrawals, refunds, fraud, support,
    refundRequestsMonth, activeProducts, creators, metricsSnap,
  ] = await Promise.all([
    count(db.collection('ageVerifications').where('status', '==', 'pending')),
    count(db.collection('creatorRequests').where('status', '==', 'pending')),
    // Produtos novos em análise + alterações de produtos aprovados.
    Promise.all([
      count(db.collection('products').where('status', '==', 'pending')),
      count(db.collection('products').where('hasPendingChanges', '==', true)),
    ]).then(([fresh, changes]) => fresh + changes),
    count(db.collection('withdrawals').where('status', 'in', ['pending', 'approved'])),
    count(db.collection('refundRequests').where('status', 'in', ['pending', 'approved'])),
    count(db.collection('fraudFlags').where('status', 'in', ['open', 'pending'])),
    count(db.collection('supportTickets').where('status', '==', 'open')),
    count(db.collection('refundRequests')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(monthStart))),
    count(db.collection('products').where('status', '==', 'approved').where('isDeleted', '==', false)),
    count(db.collection('users').where('role', '==', 'creator')),
    db.doc('adminMetrics/main').get(),
  ]);

  const m = metricsSnap.data() ?? {};
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

  const pending = { ageVerifications, creatorRequests, products, withdrawals, refunds, fraud, support };
  const totalPending = Object.values(pending).reduce((a, b) => a + b, 0);

  return {
    pending,
    totalPending,
    metrics: {
      totalSales:                n(m.totalSales),
      monthlyMarketplaceSales:   n(m.monthlyMarketplaceSales),
      monthlyCoinsSales:         n(m.monthlyCoinsSales),
      monthlyRevenue:            n(m.monthlyRevenue),
      monthlyCoinsRevenue:       n(m.monthlyCoinsRevenue),
      monthlyMarketplaceRevenue: n(m.monthlyMarketplaceRevenue),
      totalCommission:           n(m.totalCommission),
      monthlyCommission:         n(m.monthlyCommission),
      monthlyRefundedAmount:     n(m.monthlyRefundedAmount),
      monthlyRefundsApproved:    n(m.monthlyRefundsApproved),
      monthlyChargebacks:        n(m.monthlyChargebacks),
      totalWithdrawn:            n(m.totalWithdrawn),
      refundRequestsMonth,
      activeProducts,
      creators,
      updatedAt: m.updatedAt?.toDate?.()?.toISOString?.() ?? null,
    },
  };
});
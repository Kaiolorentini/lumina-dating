// ============================================
// LUMINA — FECHAMENTO DE MÉTRICAS v2
// functions/src/monitoring/resetAdminMetrics.ts
//
// Diário (00:05): arquiva o dia em metricsHistory e zera o dia.
//
// Mensal (dia 1, 00:15 — logo depois de o último dia terminar, para
// as vendas das últimas horas entrarem): gera o RELATÓRIO ESCRITO do
// mês em adminReports/{YYYY-MM} (tela Relatórios), arquiva em
// metricsHistory e zera os contadores do mês.
//
// Os acumulados (totalSales, totalCommission…) nunca são zerados.
// ============================================

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const METRICS_DOC = 'adminMetrics/main';
const TZ          = 'America/Sao_Paulo';

const MONTHLY_FIELDS = [
  'monthlyRevenue', 'monthlyCommission',
  'monthlyCoinsSales', 'monthlyCoinsRevenue',
  'monthlyMarketplaceSales', 'monthlyMarketplaceRevenue',
  'monthlyRefundedAmount', 'monthlyRefundsApproved', 'monthlyChargebacks',
] as const;

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function n(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function brl(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function monthLabel(monthId: string): string {
  const [y, m] = monthId.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} de ${y}`;
}

function previousMonthId(monthId: string): string {
  const [y, m] = monthId.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function variation(current: number, previous: number | null): string {
  if (previous === null) return 'sem mês anterior para comparar';
  if (previous === 0) return current > 0 ? 'primeiro mês com receita' : 'sem variação';
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}% (antes: ${brl(previous)})`;
}

// ── Diário ──
export const resetDailyMetrics = onSchedule(
  { schedule: '5 0 * * *', timeZone: TZ, region: 'us-central1' },
  async () => {
    const db     = admin.firestore();
    const ontem  = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateId = ontem.toLocaleDateString('en-CA', { timeZone: TZ });

    const data = (await db.doc(METRICS_DOC).get()).data() ?? {};

    await db.collection('metricsHistory').doc(`day_${dateId}`).set({
      period:   'day',
      date:     dateId,
      sales:    n(data.todaySales),
      revenue:  n(data.todayRevenue),
      closedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.doc(METRICS_DOC).set({ todaySales: 0, todayRevenue: 0 }, { merge: true });
  },
);

// ── Mensal, com relatório escrito ──
export const resetMonthlyMetrics = onSchedule(
  { schedule: '15 0 1 * *', timeZone: TZ, region: 'us-central1' },
  async () => {
    const db = admin.firestore();

    const lastDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const monthId = lastDay.toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7);
    const monthStart = new Date(`${monthId}-01T00:00:00-03:00`);
    const monthEnd   = new Date(`${new Date().toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7)}-01T00:00:00-03:00`);

    const [metricsSnap, prevReportSnap, refundRequestsCount, creatorsCount, activeProductsCount] = await Promise.all([
      db.doc(METRICS_DOC).get(),
      db.collection('adminReports').doc(previousMonthId(monthId)).get(),
      db.collection('refundRequests')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(monthStart))
        .where('createdAt', '<',  admin.firestore.Timestamp.fromDate(monthEnd))
        .count().get(),
      db.collection('users').where('role', '==', 'creator').count().get(),
      db.collection('products').where('status', '==', 'approved').where('isDeleted', '==', false).count().get(),
    ]);

    const m    = metricsSnap.data() ?? {};
    const prev = prevReportSnap.data() ?? null;

    const gross        = n(m.monthlyRevenue);
    const coinsRevenue = n(m.monthlyCoinsRevenue);
    const mktRevenue   = n(m.monthlyMarketplaceRevenue);
    const commission   = n(m.monthlyCommission);
    const refunded     = n(m.monthlyRefundedAmount);
    const net          = gross - refunded;
    const creators     = creatorsCount.data().count;
    const products     = activeProductsCount.data().count;
    const refundReqs   = refundRequestsCount.data().count;

    const newCreators = prev && typeof prev.creators === 'number' ? creators - prev.creators : null;
    const newProducts = prev && typeof prev.activeProducts === 'number' ? products - prev.activeProducts : null;
    const prevGross   = prev && typeof prev.grossRevenue === 'number' ? prev.grossRevenue : null;

    const text = [
      `Relatório de ${monthLabel(monthId)}`,
      '',
      'RECEITA',
      `• Receita bruta: ${brl(gross)}`,
      `   – Cristais e Galáxia Plus: ${brl(coinsRevenue)}`,
      `   – Vendas do marketplace: ${brl(mktRevenue)}`,
      `• Comissão do marketplace (20%): ${brl(commission)}`,
      `• Reembolsos aprovados: ${n(m.monthlyRefundsApproved)} (${brl(refunded)})`,
      `• Receita líquida (bruta − reembolsos): ${brl(net)}`,
      '',
      'VENDAS',
      `• Pacotes de cristais e Galáxia Plus: ${n(m.monthlyCoinsSales)}`,
      `• Produtos do marketplace: ${n(m.monthlyMarketplaceSales)}`,
      '',
      'REEMBOLSOS E ESTORNOS',
      `• Pedidos de reembolso no mês: ${refundReqs}`,
      `• Estornos pelo banco (chargebacks): ${n(m.monthlyChargebacks)}`,
      '',
      'PLATAFORMA',
      `• Criadores: ${creators}${newCreators !== null ? ` (${newCreators >= 0 ? '+' : ''}${newCreators} no mês)` : ''}`,
      `• Produtos ativos: ${products}${newProducts !== null ? ` (${newProducts >= 0 ? '+' : ''}${newProducts} no mês)` : ''}`,
      '',
      'COMPARAÇÃO COM O MÊS ANTERIOR',
      `• Receita bruta: ${variation(gross, prevGross)}`,
    ].join('\n');

    await db.collection('adminReports').doc(monthId).set({
      month:            monthId,
      label:            monthLabel(monthId),
      grossRevenue:     gross,
      coinsRevenue,
      marketplaceRevenue: mktRevenue,
      commission,
      refundedAmount:   refunded,
      refundsApproved:  n(m.monthlyRefundsApproved),
      netRevenue:       net,
      coinsSales:       n(m.monthlyCoinsSales),
      marketplaceSales: n(m.monthlyMarketplaceSales),
      refundRequests:   refundReqs,
      chargebacks:      n(m.monthlyChargebacks),
      creators,
      activeProducts:   products,
      text,
      createdAt:        admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('metricsHistory').doc(`month_${monthId}`).set({
      period:     'month',
      month:      monthId,
      revenue:    gross,
      commission,
      closedAt:   admin.firestore.FieldValue.serverTimestamp(),
    });

    const reset: Record<string, number> = {};
    MONTHLY_FIELDS.forEach(f => { reset[f] = 0; });
    await db.doc(METRICS_DOC).set(reset, { merge: true });

    console.log(`[resetMonthlyMetrics] ${monthId} fechado — bruta ${brl(gross)}, líquida ${brl(net)}`);
  },
);
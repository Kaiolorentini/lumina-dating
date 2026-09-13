// ============================================
// LUMINA — RESET DE MÉTRICAS PERIÓDICAS
// functions/src/monitoring/resetAdminMetrics.ts
//
// adminMetrics/main mistura contadores acumulados (totalSales,
// totalCommission) com contadores de período (todayRevenue,
// monthlyRevenue). Os de período nunca zeravam: "Receita mês"
// somava desde sempre e virava um segundo "Receita total".
//
// Estes jobs zeram só os de período. Os acumulados nunca são
// tocados — são o histórico da plataforma.
//
// Antes de zerar, o valor do período fechado vai para
// metricsHistory, para não se perder.
// ============================================

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const METRICS_DOC = 'adminMetrics/main';

// ------------------------------------------
// Diário — 00:05, depois do snapshot de economia (00:10 lê
// walletAuditLogs, não estas métricas, então não há conflito).
// ------------------------------------------
export const resetDailyMetrics = onSchedule(
  {
    schedule: '5 0 * * *',
    timeZone: 'America/Sao_Paulo',
    region:   'us-central1',
  },
  async () => {
    const db = admin.firestore();

    // Data do dia que está sendo FECHADO (ontem, já que roda 00:05).
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateId = ontem.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    const snap = await db.doc(METRICS_DOC).get();
    const data = snap.data() ?? {};

    const todaySales   = data.todaySales   ?? 0;
    const todayRevenue = data.todayRevenue ?? 0;

    // Arquiva antes de zerar — sem isto o número do dia some.
    await db.collection('metricsHistory').doc(`day_${dateId}`).set({
      period:    'day',
      date:      dateId,
      sales:     todaySales,
      revenue:   todayRevenue,
      closedAt:  admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.doc(METRICS_DOC).set({
      todaySales:   0,
      todayRevenue: 0,
    }, { merge: true });

    console.log(`[resetDailyMetrics] ${dateId} fechado: ${todaySales} vendas, R$ ${todayRevenue}`);
  }
);

// ------------------------------------------
// Mensal — dia 1 às 00:15, depois do reset diário para que o
// último dia do mês já esteja contabilizado e arquivado.
// ------------------------------------------
export const resetMonthlyMetrics = onSchedule(
  {
    schedule: '15 0 1 * *',
    timeZone: 'America/Sao_Paulo',
    region:   'us-central1',
  },
  async () => {
    const db = admin.firestore();

    // Mês que está sendo FECHADO — recua um dia para cair no
    // último dia do mês anterior, evitando aritmética de meses.
    const ultimoDiaMesAnterior = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const monthId = ultimoDiaMesAnterior
      .toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
      .slice(0, 7); // YYYY-MM

    const snap = await db.doc(METRICS_DOC).get();
    const data = snap.data() ?? {};

    const monthlyRevenue    = data.monthlyRevenue    ?? 0;
    const monthlyCommission = data.monthlyCommission ?? 0;

    await db.collection('metricsHistory').doc(`month_${monthId}`).set({
      period:     'month',
      month:      monthId,
      revenue:    monthlyRevenue,
      commission: monthlyCommission,
      closedAt:   admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.doc(METRICS_DOC).set({
      monthlyRevenue:    0,
      monthlyCommission: 0,
    }, { merge: true });

    console.log(`[resetMonthlyMetrics] ${monthId} fechado: R$ ${monthlyRevenue} receita, R$ ${monthlyCommission} comissão`);
  }
);
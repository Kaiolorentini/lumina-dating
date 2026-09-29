// ============================================
// LUMINA — MONITOR DA ECONOMIA v3
// functions/src/monitoring/inflationMonitor.ts
//
// v3 (28/09) — a economia inteira, não uma fração.
// A v2 lia walletAuditLogs, mas metade da economia não gravava lá:
// diária, Faísca, Galáxia Plus, Turbo, Fertilizante, Carta, árvore,
// níveis e TODOS os fragmentos. O ratio gasto/criado era calculado
// sobre dados incompletos. Agora todo caminho registra (v2 do
// auditLogFinanceiro), e o snapshot agrega por MOEDA e CATEGORIA.
//
// Cristais:
//   criados   = recompensas + conversões + compras
//   comprados = categoria 'compra' (pacotes E Galáxia Plus)
//   gastos    = categoria 'gasto', menos as devoluções da Carta
//   estornados= chargebacks (categoria 'estorno' negativa)
// Fragmentos: gerados, convertidos em cristais, gastos em badges.
// Impulsos: ativações do dia por tipo (premiumUsageLog), e quantas
//   saíram da assinatura.
//
// Roda às 00:10 e fecha o dia ANTERIOR (America/Sao_Paulo).
// ============================================

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { notifyAdmins } from '../utils/notifyAdmins';
import { AUDIT_TIPOS, AuditTipo, AuditCategoria, Moeda } from '../utils/auditLogFinanceiro';

/** Nomes antigos (antes da v2 do registro) que eram compra. */
const LEGACY_PURCHASE = new Set(['GALAXIA_PLUS_MENSAL', 'FIRST_PURCHASE_BONUS']);

interface FragmentosDia {
  gerados:     number;
  convertidos: number;
  gastos:      number;
  topSources:  Record<string, number>;
  topSinks:    Record<string, number>;
}

interface DailyEconomySnapshot {
  date:                     string;
  version:                  3;
  cristaisCreatedGratuitos: number;   // recompensas + conversões
  cristaisCreatedPremium:   number;   // compras (pacotes e Galáxia Plus)
  cristaisSpent:            number;
  cristaisPurchased:        number;
  cristaisRefunded:         number;   // chargebacks
  netFlow:                  number;
  ratioSpentToCreated:      number;
  activeUsers:              number;
  totalTransactions:        number;
  newWallets:               number;
  topSources:               Record<string, number>;
  topSinks:                 Record<string, number>;
  fragmentos:               FragmentosDia;
  impulsos:                 Record<string, { total: number; assinatura: number }>;
  galaxiaPlus:              { ativacoes: number };
  alertSent:                boolean;
}

function classify(tipo: string, data: Record<string, unknown>): { moeda: Moeda; categoria: AuditCategoria } {
  const info = AUDIT_TIPOS[tipo as AuditTipo];
  const moeda = (data.moeda as Moeda | undefined) ?? info?.moeda ?? 'cristal';
  let categoria = (data.categoria as AuditCategoria | undefined) ?? info?.categoria;
  if (!categoria) {
    const valor = Number(data.valor ?? 0);
    categoria = LEGACY_PURCHASE.has(tipo) ? 'compra' : valor > 0 ? 'recompensa' : 'gasto';
  }
  return { moeda, categoria };
}

function add(map: Record<string, number>, key: string, v: number): void {
  map[key] = (map[key] ?? 0) + v;
}

export const takeDailyEconomySnapshot = onSchedule(
  { schedule: '10 0 * * *', timeZone: 'America/Sao_Paulo', region: 'us-central1' },
  async () => {
    const db = admin.firestore();
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const targetDate = ontem.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    const [logsSnap, usageSnap] = await Promise.all([
      db.collection('walletAuditLogs')
        .where('createdAt', '>=', startOfDay(targetDate))
        .where('createdAt', '<=', endOfDay(targetDate))
        .get(),
      db.collection('premiumUsageLog')
        .where('activatedAt', '>=', startOfDay(targetDate))
        .where('activatedAt', '<=', endOfDay(targetDate))
        .get(),
    ]);

    let createdGratuitos = 0;
    let purchased        = 0;
    let spent            = 0;
    let spentReturned    = 0;
    let refunded         = 0;
    let galaxiaAtivacoes = 0;

    const uniqueUsers = new Set<string>();
    const topSources: Record<string, number> = {};
    const topSinks:   Record<string, number> = {};
    const frag: FragmentosDia = { gerados: 0, convertidos: 0, gastos: 0, topSources: {}, topSinks: {} };

    logsSnap.forEach((doc) => {
      const data  = doc.data();
      const tipo  = String(data.tipo ?? 'DESCONHECIDO');
      const valor = Number(data.valor ?? 0);
      const abs   = Math.abs(valor);
      if (!Number.isFinite(valor) || valor === 0) return;
      if (data.uid) uniqueUsers.add(String(data.uid));

      const { moeda, categoria } = classify(tipo, data);

      if (moeda === 'fragmento') {
        if (valor > 0) {
          frag.gerados += abs;
          add(frag.topSources, tipo, abs);
        } else {
          if (categoria === 'conversao') frag.convertidos += abs;
          else frag.gastos += abs;
          add(frag.topSinks, tipo, abs);
        }
        return;
      }

      if (tipo === 'GALAXIA_PLUS_ATIVACAO') galaxiaAtivacoes++;

      if (valor > 0) {
        if (categoria === 'estorno') {
          spentReturned += abs;            // devolução de gasto (Carta)
        } else {
          if (categoria === 'compra') purchased += abs;
          else createdGratuitos += abs;
          add(topSources, tipo, abs);
        }
      } else {
        if (categoria === 'estorno') {
          refunded += abs;                 // chargeback
        } else {
          spent += abs;
          add(topSinks, tipo, abs);
        }
      }
    });

    spent = Math.max(0, spent - spentReturned);

    const impulsos: Record<string, { total: number; assinatura: number }> = {};
    usageSnap.forEach((doc) => {
      const d = doc.data();
      const key = String(d.featureType ?? 'OUTRO');
      const entry = impulsos[key] ?? { total: 0, assinatura: 0 };
      entry.total++;
      if (d.fromSubscription === true) entry.assinatura++;
      impulsos[key] = entry;
    });

    let newWallets = 0;
    try {
      newWallets = (await db.collection('wallets')
        .where('createdAt', '>=', startOfDay(targetDate))
        .where('createdAt', '<=', endOfDay(targetDate))
        .count().get()).data().count;
    } catch (error) {
      console.warn('[inflationMonitor] Falha ao contar novas carteiras:', error);
    }

    const totalCreated = createdGratuitos + purchased;
    const ratio        = totalCreated > 0 ? spent / totalCreated : 0;
    const alertNeeded  = ratio < 0.5 && totalCreated > 1000;

    const snapshot: DailyEconomySnapshot = {
      date:                     targetDate,
      version:                  3,
      cristaisCreatedGratuitos: createdGratuitos,
      cristaisCreatedPremium:   purchased,
      cristaisSpent:            spent,
      cristaisPurchased:        purchased,
      cristaisRefunded:         refunded,
      netFlow:                  spent - totalCreated,
      ratioSpentToCreated:      Math.round(ratio * 100) / 100,
      activeUsers:              uniqueUsers.size,
      totalTransactions:        logsSnap.size,
      newWallets,
      topSources,
      topSinks,
      fragmentos:               frag,
      impulsos,
      galaxiaPlus:              { ativacoes: galaxiaAtivacoes },
      alertSent:                alertNeeded,
    };

    await db.collection('economySnapshots').doc(targetDate).set(snapshot);

    if (alertNeeded) {
      notifyAdmins({
        title: '⚠️ Alerta de inflação',
        body:  `Ratio gasto/criado em ${targetDate}: ${snapshot.ratioSpentToCreated} (meta 0.7–0.9). Criados: ${totalCreated} · Gastos: ${spent}.`,
        type:  'inflation_alert',
        data:  { date: targetDate, ratio: String(snapshot.ratioSpentToCreated) },
      }).catch(error => console.warn('[inflationMonitor] Falha ao notificar admins:', error));
    }

    console.log(`[inflationMonitor] ${targetDate} — criados ${totalCreated}, gastos ${spent}, fragmentos +${frag.gerados}`);
  },
);

export const getEconomySnapshots = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const db   = admin.firestore();
    const role = (await db.collection('users').doc(uid).get()).data()?.role;
    if (role !== 'superadmin') throw new HttpsError('permission-denied', 'Acesso restrito a superadmins.');

    const { days } = (request.data ?? {}) as { days?: number };
    const limitDays = Math.min(Math.max(Number(days) || 30, 1), 90);

    const [snap, activeSubs] = await Promise.all([
      db.collection('economySnapshots').orderBy('date', 'desc').limit(limitDays).get(),
      db.collection('galaxiaPlus')
        .where('expiresAt', '>', admin.firestore.Timestamp.now())
        .count().get(),
    ]);

    const snapshots = snap.docs.map(d => d.data() as Partial<DailyEconomySnapshot> & { date: string });

    const totals = {
      created: 0, spent: 0, purchased: 0, refunded: 0, newUsers: 0,
      fragments: { gerados: 0, convertidos: 0, gastos: 0 },
      impulsos: {} as Record<string, { total: number; assinatura: number }>,
      galaxiaAtivacoes: 0,
    };

    for (const s of snapshots) {
      totals.created   += (s.cristaisCreatedGratuitos ?? 0) + (s.cristaisCreatedPremium ?? 0);
      totals.spent     += s.cristaisSpent ?? 0;
      totals.purchased += s.cristaisPurchased ?? 0;
      totals.refunded  += s.cristaisRefunded ?? 0;
      totals.newUsers  += s.newWallets ?? 0;
      totals.fragments.gerados     += s.fragmentos?.gerados ?? 0;
      totals.fragments.convertidos += s.fragmentos?.convertidos ?? 0;
      totals.fragments.gastos      += s.fragmentos?.gastos ?? 0;
      totals.galaxiaAtivacoes      += s.galaxiaPlus?.ativacoes ?? 0;
      Object.entries(s.impulsos ?? {}).forEach(([k, v]) => {
        const e = totals.impulsos[k] ?? { total: 0, assinatura: 0 };
        e.total += v.total;
        e.assinatura += v.assinatura;
        totals.impulsos[k] = e;
      });
    }

    const ratio = totals.created > 0 ? Math.round((totals.spent / totals.created) * 100) / 100 : 0;
    let health: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (ratio < 0.5) health = 'CRITICAL';
    else if (ratio < 0.7) health = 'WARNING';

    return {
      snapshots,
      totals: { ...totals, ratio },
      health,
      alertCount: snapshots.filter(s => s.alertSent).length,
      activeSubscribers: activeSubs.data().count,
    };
  },
);

function startOfDay(date: string): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(new Date(`${date}T00:00:00-03:00`));
}

function endOfDay(date: string): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(new Date(`${date}T23:59:59.999-03:00`));
}
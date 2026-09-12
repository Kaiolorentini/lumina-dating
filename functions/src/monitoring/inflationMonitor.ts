// ============================================
// LUMINA — INFLATION MONITOR v2.1
// functions/src/monitoring/inflationMonitor.ts
//
// Acompanha cristais criados vs gastos por dia.
// Meta: 70–90% dos cristais criados devem
// voltar para o sistema (não acumular).
//
// v2.1 — CORREÇÕES DE JANELA TEMPORAL:
// 6. Roda às 00:10 e agrega o dia ANTERIOR. Antes rodava às 23:55
//    sobre o dia corrente: os últimos 5 minutos nunca entravam.
// 7. Data calculada em America/Sao_Paulo, não em UTC. toISOString()
//    às 23:55 BRT já marca o dia seguinte — todo snapshot era
//    gravado com a data errada e agregava uma janela futura,
//    saindo zerado.
// 8. endOfDay inclui os milissegundos (.999).
//
// v2.0 — CORREÇÕES:
// 1. Usa notifyAdmins() — sem UIDs hardcoded
//    (fonte única: appSettings/adminConfig.superAdmins)
// 2. activeUsers conta UIDs ÚNICOS, não documentos de log
// 3. newWallets preenchido de verdade
// 4. Novo: breakdown por tipo de entrada/saída
// 5. Novo: getEconomySnapshots — CF para o painel admin
//
// NOTA: fragmentos NÃO entram aqui. Ranking e Cofre
// gravam em economyLedger — economia separada dos cristais.
//
// ESCALA: o .get() dos logs carrega o dia inteiro em memória.
// Acima de ~10 mil transações/dia isso precisa virar paginação
// por cursor — os 256Mi da função não comportam mais que isso.
// ============================================

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { notifyAdmins } from '../utils/notifyAdmins';

interface DailyEconomySnapshot {
  date: string;
  cristaisCreatedGratuitos:  number;
  cristaisCreatedPremium:    number;
  cristaisSpent:             number;
  cristaisPurchased:         number;
  netFlow:                   number;   // spent - created (negativo = inflação)
  ratioSpentToCreated:       number;   // meta: 0.7–0.9
  activeUsers:               number;   // UIDs únicos com movimentação
  totalTransactions:         number;   // documentos de log do dia
  newWallets:                number;   // carteiras criadas no dia
  topSources:                Record<string, number>;  // de onde vieram cristais
  topSinks:                  Record<string, number>;  // para onde foram
  alertSent:                 boolean;
}

// ------------------------------------------
// Snapshot diário — roda às 00:10 e fecha o dia ANTERIOR
// ------------------------------------------
export const takeDailyEconomySnapshot = onSchedule(
  {
    // 00:10 agrega um dia já encerrado. Às 23:55 os últimos
    // 5 minutos de movimentação ficavam permanentemente fora
    // do registro — inaceitável num dado financeiro auditável.
    schedule: '10 0 * * *',
    timeZone: 'America/Sao_Paulo',
    region:   'us-central1',
  },
  async () => {
    const db = admin.firestore();

    // Roda às 00:10 e agrega o dia ANTERIOR, já fechado.
    // A data precisa ser calculada em America/Sao_Paulo:
    // toISOString() devolve UTC e, na virada, aponta o dia errado.
    // 'en-CA' formata YYYY-MM-DD, que é o id usado na collection.
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const targetDate = ontem.toLocaleDateString('en-CA', {
      timeZone: 'America/Sao_Paulo',
    });

    console.log(`[inflationMonitor] Snapshot do dia: ${targetDate}`);

    // Agrega auditLogs do dia
    const logsSnap = await db
      .collection('walletAuditLogs')
      .where('createdAt', '>=', startOfDay(targetDate))
      .where('createdAt', '<=', endOfDay(targetDate))
      .get();

    let cristaisCreatedGratuitos = 0;
    let cristaisCreatedPremium   = 0;
    let cristaisSpent            = 0;
    let cristaisPurchased        = 0;

    // CORREÇÃO 2: Set garante contagem de usuários únicos.
    // Antes usava logsSnap.size — um usuário com 10 transações
    // era contado como 10 usuários ativos.
    const uniqueUsers = new Set<string>();

    // Breakdown por origem — mostra QUAL feature gera/consome mais
    const topSources: Record<string, number> = {};
    const topSinks:   Record<string, number> = {};

    logsSnap.forEach((doc) => {
      const data = doc.data();
      const val  = Math.abs(data.valor ?? 0);
      const tipo = data.tipo ?? 'DESCONHECIDO';

      if (data.uid) uniqueUsers.add(data.uid);

      if (data.valor > 0) {
        if (data.tipo === 'COMPRA_ASAAS' || data.tipo === 'GALAXIA_PLUS_MENSAL') {
          cristaisCreatedPremium += val;
          cristaisPurchased      += val;
        } else {
          cristaisCreatedGratuitos += val;
        }
        topSources[tipo] = (topSources[tipo] ?? 0) + val;
      } else if (data.valor < 0) {
        cristaisSpent  += val;
        topSinks[tipo]  = (topSinks[tipo] ?? 0) + val;
      }
    });

    // CORREÇÃO 3: newWallets preenchido de verdade
    let newWallets = 0;
    try {
      const walletsSnap = await db
        .collection('wallets')
        .where('createdAt', '>=', startOfDay(targetDate))
        .where('createdAt', '<=', endOfDay(targetDate))
        .count()
        .get();
      newWallets = walletsSnap.data().count;
    } catch (error) {
      // count() exige índice em alguns casos — falha não derruba o snapshot
      console.warn('[inflationMonitor] Falha ao contar novas carteiras:', error);
    }

    const totalCreated = cristaisCreatedGratuitos + cristaisCreatedPremium;
    const netFlow      = cristaisSpent - totalCreated;
    const ratio        = totalCreated > 0 ? cristaisSpent / totalCreated : 0;

    // Alerta se ratio < 0.5 (menos de 50% voltando ao sistema).
    // O piso de 1000 cristais evita ruído em dias de baixo volume —
    // na base atual isso significa que o alerta raramente dispara.
    const alertNeeded = ratio < 0.5 && totalCreated > 1000;

    const snapshot: DailyEconomySnapshot = {
      date:                    targetDate,
      cristaisCreatedGratuitos,
      cristaisCreatedPremium,
      cristaisSpent,
      cristaisPurchased,
      netFlow,
      ratioSpentToCreated:     Math.round(ratio * 100) / 100,
      activeUsers:             uniqueUsers.size,
      totalTransactions:       logsSnap.size,
      newWallets,
      topSources,
      topSinks,
      alertSent:               alertNeeded,
    };

    await db.collection('economySnapshots').doc(targetDate).set(snapshot);

    // CORREÇÃO 1: notifyAdmins lê os superadmins do appSettings.
    // Fire-and-forget — nunca derruba o snapshot.
    if (alertNeeded) {
      notifyAdmins({
        title: '⚠️ Alerta de inflação',
        body:  `Ratio gasto/criado em ${targetDate}: ${snapshot.ratioSpentToCreated} (meta 0.7–0.9). Criados: ${totalCreated} · Gastos: ${cristaisSpent}.`,
        type:  'inflation_alert',
        data: {
          date:  targetDate,
          ratio: String(snapshot.ratioSpentToCreated),
        },
      }).catch((error) => {
        console.warn('[inflationMonitor] Falha ao notificar admins:', error);
      });
    }

    console.log(
      `[inflationMonitor] Ratio: ${ratio.toFixed(2)} | Criado: ${totalCreated} | ` +
      `Gasto: ${cristaisSpent} | Usuários únicos: ${uniqueUsers.size} | Novas carteiras: ${newWallets}`
    );
  }
);

// ------------------------------------------
// CF para o painel admin — lista snapshots
// Apenas superadmin acessa
// ------------------------------------------
export const getEconomySnapshots = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const db = admin.firestore();

    // Verifica superadmin server-side — nunca confia no cliente
    const userDoc = await db.collection('users').doc(uid).get();
    const role    = userDoc.data()?.role;
    if (role !== 'superadmin') {
      throw new HttpsError('permission-denied', 'Acesso restrito a superadmins.');
    }

    const { days } = (request.data ?? {}) as { days?: number };
    const limitDays = Math.min(Math.max(days ?? 30, 1), 90);

    const snap = await db
      .collection('economySnapshots')
      .orderBy('date', 'desc')
      .limit(limitDays)
      .get();

    const snapshots = snap.docs.map(d => d.data() as DailyEconomySnapshot);

    // Agregados do período
    const totals = snapshots.reduce(
      (acc, s) => ({
        created:   acc.created   + s.cristaisCreatedGratuitos + s.cristaisCreatedPremium,
        spent:     acc.spent     + s.cristaisSpent,
        purchased: acc.purchased + s.cristaisPurchased,
        newUsers:  acc.newUsers  + (s.newWallets ?? 0),
      }),
      { created: 0, spent: 0, purchased: 0, newUsers: 0 }
    );

    const periodRatio = totals.created > 0
      ? Math.round((totals.spent / totals.created) * 100) / 100
      : 0;

    // Saúde da economia
    let health: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (periodRatio < 0.5)      health = 'CRITICAL';
    else if (periodRatio < 0.7) health = 'WARNING';

    return {
      snapshots,
      totals: { ...totals, ratio: periodRatio },
      health,
      alertCount: snapshots.filter(s => s.alertSent).length,
    };
  }
);

function startOfDay(date: string): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(new Date(`${date}T00:00:00-03:00`));
}

// 23:59:59.999 — sem os milissegundos, um log gravado em
// 23:59:59.500 ficava fora da janela, porque Timestamp compara
// com precisão de nanossegundos.
function endOfDay(date: string): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(new Date(`${date}T23:59:59.999-03:00`));
}
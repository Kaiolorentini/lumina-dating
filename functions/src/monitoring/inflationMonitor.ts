// ============================================
// LUMINA — INFLATION MONITOR
// functions/src/monitoring/inflationMonitor.ts
//
// Acompanha cristais criados vs gastos por dia.
// Meta: 70–90% dos cristais criados devem
// voltar para o sistema (não acumular).
// Alerta superadmin se inflação detectada.
// ============================================

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

interface DailyEconomySnapshot {
  date: string;
  cristaisCreatedGratuitos:  number;
  cristaisCreatedPremium:    number;
  cristaisSpent:             number;
  cristaisPurchased:         number;
  netFlow:                   number;   // spent - created (negativo = inflação)
  ratioSpentToCreated:       number;   // meta: 0.7–0.9
  activeUsers:               number;
  newWallets:                number;
  alertSent:                 boolean;
}

// ------------------------------------------
// Snapshot diário — roda às 23:55 todo dia
// ------------------------------------------
export const takeDailyEconomySnapshot = onSchedule(
  {
    schedule: '55 23 * * *',
    timeZone: 'America/Sao_Paulo',
    region:   'us-central1',
  },
  async () => {
    const db   = admin.firestore();
    const today = new Date().toISOString().slice(0, 10);

    console.log(`[inflationMonitor] Snapshot do dia: ${today}`);

    // Agrega auditLogs do dia
    const logsSnap = await db
      .collection('walletAuditLogs')
      .where('createdAt', '>=', startOfDay(today))
      .where('createdAt', '<=', endOfDay(today))
      .get();

    let cristaisCreatedGratuitos = 0;
    let cristaisCreatedPremium   = 0;
    let cristaisSpent            = 0;
    let cristaisPurchased        = 0;

    logsSnap.forEach((doc) => {
      const data = doc.data();
      const val  = Math.abs(data.valor ?? 0);

      if (data.valor > 0) {
        if (data.tipo === 'COMPRA_ASAAS' || data.tipo === 'GALAXIA_PLUS_MENSAL') {
          cristaisCreatedPremium += val;
          cristaisPurchased      += val;
        } else {
          cristaisCreatedGratuitos += val;
        }
      } else {
        cristaisSpent += val;
      }
    });

    const totalCreated = cristaisCreatedGratuitos + cristaisCreatedPremium;
    const netFlow      = cristaisSpent - totalCreated;
    const ratio        = totalCreated > 0
      ? cristaisSpent / totalCreated
      : 0;

    // Alerta se ratio < 0.5 (menos de 50% voltando ao sistema)
    const alertNeeded = ratio < 0.5 && totalCreated > 1000;

    const snapshot: DailyEconomySnapshot = {
      date:                    today,
      cristaisCreatedGratuitos,
      cristaisCreatedPremium,
      cristaisSpent,
      cristaisPurchased,
      netFlow,
      ratioSpentToCreated:     Math.round(ratio * 100) / 100,
      activeUsers:             logsSnap.size,
      newWallets:              0, // preenchido abaixo
      alertSent:               alertNeeded,
    };

    await db.collection('economySnapshots').doc(today).set(snapshot);

    if (alertNeeded) {
      await sendInflationAlert(db, snapshot);
    }

    console.log(`[inflationMonitor] Ratio: ${ratio.toFixed(2)} | Total criado: ${totalCreated} | Gasto: ${cristaisSpent}`);
  }
);

async function sendInflationAlert(
  db: admin.firestore.Firestore,
  snapshot: DailyEconomySnapshot
): Promise<void> {
  const SUPERADMIN_UIDS = [
    'DOoEhA9B2QZfTnJrIBJIUhNjuC23',
    '8DyoecyZiuPOwvCDoO9WekJkVkH3',
  ];

  const batch = db.batch();

  for (const uid of SUPERADMIN_UIDS) {
    const notifRef = db.collection('notifications').doc();
    batch.set(notifRef, {
      userId:  uid,
      type:    'inflation_alert',
      message: `⚠️ Alerta de inflação detectado em ${snapshot.date}. Ratio gasto/criado: ${snapshot.ratioSpentToCreated} (meta: 0.7–0.9). Cristais criados: ${snapshot.cristaisCreatedGratuitos + snapshot.cristaisCreatedPremium}. Gastos: ${snapshot.cristaisSpent}.`,
      read:    false,
      icon:    '⚠️',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.warn('[inflationMonitor] ALERTA DE INFLAÇÃO enviado para superadmins.');
}

function startOfDay(date: string): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(new Date(`${date}T00:00:00-03:00`));
}

function endOfDay(date: string): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(new Date(`${date}T23:59:59-03:00`));
}
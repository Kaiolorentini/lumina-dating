// ============================================
// LUMINA — REDE DE SEGURANÇA
// functions/src/users/expireMarketplaceBans.ts
//
// Varre bans vencidos uma vez por dia. Cobre quem não
// abriu o app: sem isso, um papel rebaixado ficaria
// caído para sempre numa conta inativa.
//
// Query indexada por marketplaceBanUntil — custo de uma
// execução diária lendo só os documentos vencidos.
//
// ÍNDICE NECESSÁRIO: campo único marketplaceBanUntil
// (ascendente). Índice de campo único é automático no
// Firestore, então não precisa entrar no
// firestore.indexes.json.
// ============================================

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { buildRestorePatch } from "../utils/marketplaceBan";

const BATCH_LIMIT = 200;

export const expireMarketplaceBans = onSchedule(
  {
    schedule: "every day 04:10",
    timeZone: "America/Sao_Paulo",
    region: "us-central1",
  },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    const snap = await db
      .collection("users")
      .where("marketplaceBanUntil", "<=", now)
      .limit(BATCH_LIMIT)
      .get();

    if (snap.empty) {
      console.log("[expireMarketplaceBans] Nenhum ban vencido");
      return;
    }

    const batch = db.batch();
    let count = 0;

    snap.docs.forEach((doc) => {
      const patch = buildRestorePatch(doc.data());
      if (!patch) return;
      batch.update(doc.ref, patch);
      count++;
    });

    if (count === 0) {
      console.log("[expireMarketplaceBans] Nada a restaurar");
      return;
    }

    await batch.commit();
    console.log(`[expireMarketplaceBans] Restaurados: ${count} de ${snap.size}`);

    if (snap.size === BATCH_LIMIT) {
      console.warn("[expireMarketplaceBans] Lote cheio — o restante cai na próxima execução");
    }
  }
);
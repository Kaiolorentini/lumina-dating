// ============================================
// LUMINA — DESCARTAR PERFIL NO SINTONIZE
// functions/src/engagement/dismissProfile.ts
//
// Passar sem curtir tira a pessoa da fila por 24 horas. O
// campo vive em `progression.dismissedProfiles`, que é
// protegido nas rules — daí a CF.
//
// ── POR QUE O MAPA NÃO CRESCE PARA SEMPRE ──
//
// A cada gravação, as entradas vencidas são removidas. Sem
// isso, quem usa o app por meses acumularia milhares de uids
// no próprio documento, e o documento do usuário é lido em
// TODA abertura do app — o custo apareceria em tudo.
//
// O Firestore cobra por documento lido, não por campo, mas há
// um limite duro de 1 MB por documento.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated } from "../utils/adminGuard";

const db = admin.firestore();

const DISMISS_HOURS = 24;

/** Teto de segurança: acima disso, mantém só os mais recentes. */
const MAX_ENTRIES = 300;

export const dismissProfile = onCall(
  { region: "us-central1" },
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const uid: string = request.auth!.uid;

    const { targetUid } = (request.data ?? {}) as { targetUid?: string };

    if (!targetUid || typeof targetUid !== "string") {
      throw new HttpsError("invalid-argument", "targetUid obrigatório");
    }
    if (targetUid === uid) {
      throw new HttpsError("invalid-argument", "Não é possível descartar a si mesmo");
    }

    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      const current: Record<string, number> =
        snap.data()?.progression?.dismissedProfiles ?? {};

      const cutoff = Date.now() - DISMISS_HOURS * 3600 * 1000;

      // Limpeza na própria escrita: sem isto o mapa cresceria
      // sem limite no documento que o app lê em toda abertura.
      const kept: Record<string, number> = {};
      for (const [id, at] of Object.entries(current)) {
        if (typeof at === "number" && at > cutoff) kept[id] = at;
      }

      kept[targetUid] = Date.now();

      // Teto de segurança para o caso de alguém passar centenas
      // de perfis em poucas horas.
      let finalMap = kept;
      const ids = Object.keys(kept);
      if (ids.length > MAX_ENTRIES) {
        const recent = ids
          .sort((a, b) => kept[b] - kept[a])
          .slice(0, MAX_ENTRIES);
        finalMap = {};
        for (const id of recent) finalMap[id] = kept[id];
      }

      // Substitui o mapa inteiro, sem merge do campo: o merge
      // manteria as entradas vencidas que acabamos de remover.
      // `update` com notação de ponto SUBSTITUI o campo inteiro.
      // Um `set` com merge faria merge também do mapa interno, e
      // as entradas vencidas que acabamos de remover voltariam.
      t.update(userRef, { "progression.dismissedProfiles": finalMap });
    });

    return { success: true };
  },
);
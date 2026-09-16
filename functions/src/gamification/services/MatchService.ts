// ============================================
// LUMINA — MATCH SERVICE v1.1
// functions/src/gamification/services/MatchService.ts
//
// ADR-001: MatchService emite o evento MATCH_CREATED.
// Nunca um trigger Firestore.
// Regra de negócio vive aqui, não na persistência.
//
// v1.1 — gamificationProcessed entra na transação.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { GamificationIntegrationService } from '../GamificationIntegrationService';

const db = admin.firestore();

export interface MatchResult {
  matchId:   string;
  uid:       string;
  targetUid: string;
  isNew:     boolean;
}

export const MatchService = {

  // Cria Sintonia e emite MATCH_CREATED — nunca via trigger
  async createMatch(uid: string, targetUid: string): Promise<MatchResult> {
    const matchId  = [uid, targetUid].sort().join('_');
    const matchRef = db.collection('sintonias').doc(matchId);

    const result = await db.runTransaction(async (t) => {
      const matchDoc = await t.get(matchRef);
      const data     = matchDoc.exists ? matchDoc.data()! : null;

      // Já processado: nem grava nem reemite.
      if (data?.gamificationProcessed === true) {
        return { matchId, uid, targetUid, isNew: false };
      }

      const likedBy: string[] = data?.likedBy ?? [];

      // Adiciona curtida do uid atual
      if (!likedBy.includes(uid)) {
        likedBy.push(uid);
      }

      const isMutual = likedBy.includes(uid) && likedBy.includes(targetUid);

      // A flag entra na MESMA transação. Fora dela, duas chamadas
      // concorrentes no instante do match liam `false` as duas e
      // emitiam MATCH_CREATED em dobro — 100 XP e 100 treeXP por
      // uma sintonia só. E o `false` fixo aqui ainda podia
      // sobrescrever o `true` gravado logo depois.
      t.set(matchRef, {
        matchId,
        users:     [uid, targetUid],
        likedBy,
        isMutual,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        gamificationProcessed: isMutual,
      }, { merge: true });

      return { matchId, uid, targetUid, isNew: isMutual };
    });

    // Emite gamificação apenas se é match mútuo novo (ADR-001).
    // A exclusividade já foi garantida dentro da transação.
    if (result.isNew) {
      GamificationIntegrationService.handleMatchCreated({ uid, targetUid });
    }

    return result;
  },
};
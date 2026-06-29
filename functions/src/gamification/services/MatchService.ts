// ============================================
// LUMINA — MATCH SERVICE v1.0
// functions/src/gamification/services/MatchService.ts
//
// ADR-001: MatchService emite o evento MATCH_CREATED.
// Nunca um trigger Firestore.
// Regra de negócio vive aqui, não na persistência.
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

      // Se já existe, verifica se é nova para gamificação
      if (matchDoc.exists) {
        const data = matchDoc.data()!;
        if (data.gamificationProcessed === true) {
          return { matchId, uid, targetUid, isNew: false };
        }
      }

      const likedBy = matchDoc.exists
        ? (matchDoc.data()!.likedBy ?? [])
        : [];

      // Adiciona curtida do uid atual
      if (!likedBy.includes(uid)) {
        likedBy.push(uid);
      }

      const isMutual = likedBy.includes(uid) && likedBy.includes(targetUid);

      t.set(matchRef, {
        matchId,
        users:     [uid, targetUid],
        likedBy,
        isMutual,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        gamificationProcessed: false,
      }, { merge: true });

      return { matchId, uid, targetUid, isNew: isMutual };
    });

    // Emite gamificação apenas se é match mútuo novo (ADR-001)
    if (result.isNew) {
      GamificationIntegrationService.handleMatchCreated({ uid, targetUid });

      // Marca como processado para evitar duplicatas
      await matchRef.set({ gamificationProcessed: true }, { merge: true });
    }

    return result;
  },
};
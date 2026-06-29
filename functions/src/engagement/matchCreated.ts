// ============================================
// LUMINA — ON MATCH CREATED v1.0
// functions/src/engagement/matchCreated.ts
//
// CF chamada pelo MatchService — nunca pelo cliente.
// ADR-001: regra de negócio no MatchService, não no trigger.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import { MatchService } from '../gamification/services/MatchService';

// CF chamada quando usuário curte um perfil — MatchService decide se é match
export const onCreateMatch = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { targetUid } = request.data as { targetUid: string };

    if (!targetUid) {
      throw new functions.HttpsError('invalid-argument', 'targetUid obrigatório.');
    }

    if (uid === targetUid) {
      throw new functions.HttpsError('invalid-argument', 'Auto-match não permitido.');
    }

    // MatchService decide se é match mútuo e emite MATCH_CREATED (ADR-001)
    const result = await MatchService.createMatch(uid, targetUid);

    return {
      success:  true,
      matchId:  result.matchId,
      isNew:    result.isNew,
      isMutual: result.isNew,
    };
  }
);
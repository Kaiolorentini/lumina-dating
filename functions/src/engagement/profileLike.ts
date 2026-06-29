// ============================================
// LUMINA — ON PROFILE LIKE v1.0
// functions/src/engagement/profileLike.ts
//
// CF chamada pelo cliente após salvar curtida.
// Delega tudo ao ProfileLikeOrchestrator.
// Nunca contém lógica de negócio.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import { ProfileLikeOrchestrator } from '../gamification/orchestrators/ProfileLikeOrchestrator';

function newCorrelationId(): string {
  return `like_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const onProfileLike = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { likerUid, targetUid } = request.data as {
      likerUid:  string;
      targetUid: string;
    };

    // Garante que quem chamou é o próprio liker
    if (likerUid !== uid) {
      throw new functions.HttpsError('permission-denied', 'likerUid não corresponde ao token.');
    }

    const orchestrator = new ProfileLikeOrchestrator();
    await orchestrator.execute({
      uid:           likerUid,
      targetUid,
      correlationId: newCorrelationId(),
    });

    return { success: true };
  }
);
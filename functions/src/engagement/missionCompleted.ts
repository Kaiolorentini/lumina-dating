// ============================================
// LUMINA — ON MISSION COMPLETED v1.0
// functions/src/engagement/missionCompleted.ts
//
// CF chamada após conclusão de missão.
// Delega tudo ao MissionCompletedOrchestrator.
// Nunca gera Cristais Premium.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import { MissionCompletedOrchestrator } from '../gamification/orchestrators/MissionCompletedOrchestrator';

function newCorrelationId(): string {
  return `mission_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const onMissionCompleted = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { missionId, missionCategory } = request.data as {
      missionId:       string;
      missionCategory: string;
    };

    if (!missionId) {
      throw new functions.HttpsError('invalid-argument', 'missionId obrigatório.');
    }

    const orchestrator = new MissionCompletedOrchestrator();
    await orchestrator.execute({
      uid,
      correlationId: newCorrelationId(),
      meta:          { missionId, missionCategory },
    });

    return { success: true };
  }
);
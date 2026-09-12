// ============================================
// LUMINA — GAMIFICATION ENGINE v1.3
// functions/src/gamification/GamificationEngine.ts
//
// BLOCO 4 — Wrapper fino sobre GameEventProcessor.
// Toda lógica está em GameEventProcessor.process().
// ============================================

import * as functions from 'firebase-functions/v2/https';
import { GameEventInput, GameEventResult } from './GameEventContext';
import { GameEventProcessor }              from './GameEventProcessor';

export const processGameEvent = functions.onCall(
  { region: 'us-central1' },
  async (request): Promise<GameEventResult> => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const input = request.data as GameEventInput;
    if (input.uid !== uid) {
      throw new functions.HttpsError('permission-denied', 'uid não corresponde ao token.');
    }

    const processor = new GameEventProcessor({
      correlationId: `call_${Date.now().toString(36)}`,
      originCF:      'processGameEvent',
      triggerName:   'onCall',
    });

    return processor.process(input);
  }
);
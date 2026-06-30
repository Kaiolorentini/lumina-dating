// ============================================
// LUMINA — PRESTIGE SERVICE v1.0
// functions/src/gamification/services/PrestigeService.ts
//
// SPRINT 1A — Prestígio evolui apenas com MATCH_CREATED,
// igual à Árvore (camada intermediária de progressão).
// computeEvolution() calcula sem persistir (LEGACY/SHADOW).
// persist() grava de fato — só chamado em modo ENGINE.
// ============================================

import * as admin from 'firebase-admin';
import { PrestigeRepository } from '../repositories/PrestigeRepository';
import { calcPrestigeStage }  from '../../config/prestigeTable';

const db = admin.firestore();

const PRESTIGE_POINTS_PER_MATCH = 5;

export interface PrestigeComputation {
  skipped:       boolean;
  reason?:       string;
  newPoints?:    number;
  newStage?:     number;
  stageChanged?: boolean;
  stageName?:    string;
}

export const PrestigeService = {

  canHandle(eventType: string): boolean {
    return eventType === 'MATCH_CREATED';
  },

  async computeEvolution(uid: string, eventType: string): Promise<PrestigeComputation> {
    if (!this.canHandle(eventType)) {
      return { skipped: true, reason: `Prestígio só evolui com MATCH_CREATED, recebido ${eventType}` };
    }

    const snapshot  = await PrestigeRepository.getSnapshot(uid);
    const newPoints = snapshot.prestigePoints + PRESTIGE_POINTS_PER_MATCH;
    const newStage  = calcPrestigeStage(newPoints);
    const oldStage  = calcPrestigeStage(snapshot.prestigePoints);

    return {
      skipped:      false,
      newPoints,
      newStage:     newStage.stage,
      stageChanged: newStage.stage > oldStage.stage,
      stageName:    newStage.name,
    };
  },

  // Persiste de fato — só deve ser chamado em modo ENGINE
  async persist(uid: string, computation: PrestigeComputation): Promise<void> {
    if (computation.skipped) return;

    const { newStage, stageName, stageChanged } = computation;

    await db.runTransaction(async (t) => {
      PrestigeRepository.write(t, uid, PRESTIGE_POINTS_PER_MATCH, newStage!, stageName!);

      if (stageChanged) {
        PrestigeRepository.writeNotification(t, uid, {
          title:   `👑 Você evoluiu de estágio!`,
          message: `Você agora é ${stageName}.`,
          dados:   { stage: newStage },
        });
      }
    });
  },
};
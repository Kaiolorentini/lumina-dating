// ============================================
// LUMINA — TREE SERVICE v1.0
// functions/src/gamification/services/TreeService.ts
//
// SPRINT 1A — A árvore evolui apenas com MATCH_CREATED.
// computeEvolution() calcula sem persistir (LEGACY/SHADOW).
// persist() grava de fato — só chamado em modo ENGINE.
// ============================================

import * as admin from 'firebase-admin';
import { TreeRepository } from '../repositories/TreeRepository';
import { calcTreeStage }  from '../../config/treeTable';

const db = admin.firestore();

// Apenas MATCH_CREATED evolui a árvore (igual ao legado)
const TREE_XP_PER_MATCH = 25;

export interface TreeComputation {
  skipped:       boolean;
  reason?:       string;
  newTreeXP?:    number;
  newStage?:     number;
  stageChanged?: boolean;
  stageName?:    string;
  stageIcon?:    string;
  progress?:     number;
}

export const TreeService = {

  canHandle(eventType: string): boolean {
    return eventType === 'MATCH_CREATED';
  },

  async computeEvolution(uid: string, eventType: string): Promise<TreeComputation> {
    if (!this.canHandle(eventType)) {
      return { skipped: true, reason: `Árvore só evolui com MATCH_CREATED, recebido ${eventType}` };
    }

    const snapshot  = await TreeRepository.getSnapshot(uid);
    const newTreeXP = snapshot.treeXP + TREE_XP_PER_MATCH;
    const newTree   = calcTreeStage(newTreeXP);
    const oldTree   = calcTreeStage(snapshot.treeXP);

    return {
      skipped:      false,
      newTreeXP,
      newStage:     newTree.current.stage,
      stageChanged: newTree.current.stage > oldTree.current.stage,
      stageName:    newTree.current.name,
      stageIcon:    newTree.current.icon,
      progress:     newTree.progress,
    };
  },

  // Persiste de fato — só deve ser chamado em modo ENGINE
  async persist(uid: string, computation: TreeComputation): Promise<void> {
    if (computation.skipped) return;

    const { newStage, stageName, stageIcon, progress, stageChanged } = computation;

    await db.runTransaction(async (t) => {
      TreeRepository.writeStage(t, uid, newStage!, stageName!, stageIcon!, progress!);

      if (stageChanged) {
        TreeRepository.writeNotification(t, uid, {
          title:   `🌳 Sua árvore evoluiu!`,
          message: `Sua árvore agora é ${stageName}.`,
          icon:    stageIcon,
          dados:   { stage: newStage },
        });
      }
    });
  },
};

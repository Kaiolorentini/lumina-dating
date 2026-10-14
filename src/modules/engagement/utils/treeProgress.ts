// ============================================
// LUMINA — PROGRESSO NO ESTÁGIO DA ÁRVORE
// src/modules/engagement/utils/treeProgress.ts
//
// Quanto da fase ATUAL da Árvore já foi feito (0 a 1) e quantos XP
// faltam para a próxima. Usado pela Home e pelo Perfil do
// computador — a mesma conta nos dois lugares.
// ============================================

import type { XPStatus } from '../hooks/useXP';

export interface TreeStageProgress {
  /** 0 a 1 dentro do estágio atual (1 no estágio máximo). */
  fraction: number;
  /** XP da Árvore que faltam para o próximo estágio; null no máximo. */
  missing:  number | null;
}

export function treeStageProgress(xp: XPStatus): TreeStageProgress {
  if (!xp.nextTreeStage) return { fraction: 1, missing: null };
  const currentMin = xp.treeStages?.find(s => s.stage === xp.treeStage)?.treeXPMin ?? 0;
  const span = xp.nextTreeStage.treeXPMin - currentMin;
  const raw  = span > 0 ? (xp.treeXP - currentMin) / span : 0;
  return {
    fraction: Math.min(1, Math.max(0, raw)),
    missing:  Math.max(0, xp.nextTreeStage.treeXPMin - xp.treeXP),
  };
}

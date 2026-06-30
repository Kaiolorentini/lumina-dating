// ============================================
// LUMINA — PRESTIGE CALCULATOR v1.0
// functions/src/gamification/calculators/PrestigeCalculator.ts
//
// SPRINT 1C — Função pura. Sem Firestore. Sem Transactions.
// ============================================

import { calcPrestigeStage } from '../../config/prestigeTable';

const PRESTIGE_POINTS_PER_MATCH = 5;

export interface PrestigeCalculatorInput {
  isMatchEvent:        boolean; // prestígio só evolui com MATCH_CREATED
  currentPrestigePoints: number;
}

export interface PrestigeCalculatorOutput {
  prestigePoints: number;
  stage:          number;
}

export function calculatePrestige(input: PrestigeCalculatorInput): PrestigeCalculatorOutput | null {
  if (!input.isMatchEvent) return null;

  const newPoints = input.currentPrestigePoints + PRESTIGE_POINTS_PER_MATCH;
  const newStage   = calcPrestigeStage(newPoints);

  return { prestigePoints: newPoints, stage: newStage.stage };
}
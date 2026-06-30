// ============================================
// LUMINA — XP CALCULATOR v1.0
// functions/src/gamification/calculators/XPCalculator.ts
//
// SPRINT 1C — Função pura. Sem Firestore. Sem Transactions.
// Replica exatamente a lógica de cálculo do XPService,
// mas recebe todo o estado como parâmetro (testável isoladamente).
// ============================================

import { XP_ACTION_VALUES, DAILY_XP_MAX } from '../../config/xpValues';
import { XP_MULTIPLIERS }                  from '../../config/xpMultipliers';
import { calcLevel }                       from '../../config/xpTable';

export interface XPCalculatorInput {
  actionKey:        string;
  currentTotalXP:   number;
  currentXPToday:   number;
  fertilizerActive: boolean;
}

export interface XPCalculatorOutput {
  xpAmount: number;
  newXP:    number;
  newLevel: number;
}

export function calculateXP(input: XPCalculatorInput): XPCalculatorOutput | null {
  const actionDef = XP_ACTION_VALUES[input.actionKey];
  if (!actionDef) return null;

  if (input.currentXPToday >= DAILY_XP_MAX) return null;

  const multiplier = input.fertilizerActive ? XP_MULTIPLIERS.FERTILIZER : XP_MULTIPLIERS.NORMAL;
  const xpAmount    = Math.min(Math.floor(actionDef.xp * multiplier), DAILY_XP_MAX - input.currentXPToday);
  const newXP        = input.currentTotalXP + xpAmount;
  const newLevel      = calcLevel(newXP).level;

  return { xpAmount, newXP, newLevel };
}
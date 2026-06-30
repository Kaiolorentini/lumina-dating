// ============================================
// LUMINA — ACHIEVEMENT CALCULATOR v1.0
// functions/src/gamification/calculators/AchievementCalculator.ts
//
// SPRINT 1C — Função pura. Sem Firestore. Sem Transactions.
// ============================================

import { ACHIEVEMENTS_CATALOG, ACHIEVEMENTS_BY_ACTION } from '../../config/achievementsCatalog';

export interface AchievementCalculatorInput {
  actionKey:        string;
  currentUnlocked:  string[];
  currentProgress:  Record<string, number>;
}

export interface AchievementCalculatorOutput {
  unlockedIds: string[]; // todas as conquistas desbloqueadas após este evento (incluindo as antigas)
}

export function calculateAchievements(input: AchievementCalculatorInput): AchievementCalculatorOutput | null {
  const relatedIds = ACHIEVEMENTS_BY_ACTION[input.actionKey] ?? [];
  if (relatedIds.length === 0) return null;

  const unlocked = [...input.currentUnlocked];

  for (const achId of relatedIds) {
    const ach = ACHIEVEMENTS_CATALOG[achId];
    if (!ach || unlocked.includes(achId)) continue;

    const newProgress = (input.currentProgress[achId] ?? 0) + 1;
    if (newProgress >= ach.target) {
      unlocked.push(achId);
    }
  }

  return { unlockedIds: unlocked };
}
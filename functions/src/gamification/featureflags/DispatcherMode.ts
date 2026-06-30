// ============================================
// LUMINA — DISPATCHER MODE v1.1
// functions/src/gamification/featureflags/DispatcherMode.ts
//
// v1.1: adiciona TREE e PRESTIGE ao mapeamento.
// ============================================

import { LegacyFeatureFlags, LegacySystem } from './LegacyFeatureFlags';

export type DispatcherMode = 'LEGACY' | 'SHADOW' | 'ENGINE';

const LEGACY_FLAG_KEY: Record<LegacySystem, keyof Awaited<ReturnType<typeof LegacyFeatureFlags.getState>>> = {
  XP:          'LegacyXP',
  RANKING:     'LegacyRanking',
  ACHIEVEMENT: 'LegacyAchievement',
  VAULT:       'LegacyVault',
  TREE:        'LegacyTree',
  PRESTIGE:    'LegacyPrestige',
};

export async function getDispatcherMode(system: LegacySystem): Promise<DispatcherMode> {
  const state = await LegacyFeatureFlags.getState();
  const flagKey = LEGACY_FLAG_KEY[system];
  const isLegacyActive = state[flagKey] === true;

  if (!isLegacyActive) {
    return 'ENGINE';
  }

  if (state.ShadowModeEnabled) {
    return 'SHADOW';
  }

  return 'LEGACY';
}
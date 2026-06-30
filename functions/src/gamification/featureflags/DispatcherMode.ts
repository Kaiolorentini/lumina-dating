// ============================================
// LUMINA — DISPATCHER MODE v1.0
// functions/src/gamification/featureflags/DispatcherMode.ts
//
// REGRA DO PROJETO: nenhum Dispatcher novo produz efeito
// em produção enquanto o sistema correspondente ainda for
// executado pelo legado.
//
// 3 modos por sistema:
//   LEGACY → Engine calcula mas não persiste. Legado é a fonte da verdade.
//   SHADOW → Engine calcula + compara com legado. Nunca persiste.
//   ENGINE → Engine persiste. Legado desligado.
// ============================================

import { LegacyFeatureFlags, LegacySystem } from './LegacyFeatureFlags';

export type DispatcherMode = 'LEGACY' | 'SHADOW' | 'ENGINE';

// Mapeia sistema → chave da flag correspondente
const LEGACY_FLAG_KEY: Record<LegacySystem, 'LegacyXP' | 'LegacyRanking' | 'LegacyAchievement' | 'LegacyVault'> = {
  XP:          'LegacyXP',
  RANKING:     'LegacyRanking',
  ACHIEVEMENT: 'LegacyAchievement',
  VAULT:       'LegacyVault',
};

// Determina o modo atual de um sistema baseado nas flags
export async function getDispatcherMode(system: LegacySystem): Promise<DispatcherMode> {
  const state = await LegacyFeatureFlags.getState();
  const isLegacyActive = state[LEGACY_FLAG_KEY[system]] === true;

  if (!isLegacyActive) {
    return 'ENGINE'; // Legado desligado → Engine é a fonte da verdade
  }

  if (state.ShadowModeEnabled) {
    return 'SHADOW'; // Legado ativo + Shadow Mode → compara sem persistir
  }

  return 'LEGACY'; // Legado ativo, sem Shadow Mode → Engine nem calcula efeito real
}
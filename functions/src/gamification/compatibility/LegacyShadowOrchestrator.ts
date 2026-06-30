// ============================================
// LUMINA — LEGACY SHADOW ORCHESTRATOR v1.0
// functions/src/gamification/compatibility/LegacyShadowOrchestrator.ts
//
// SPRINT 1C — Ponto único chamado pelo legado (earnXP, etc.)
// para disparar comparação em TODOS os Adapters relevantes
// para uma ação. Fire-and-forget. Nunca lança erro.
// ============================================

import { getRegisteredSystems, getCompatibilityAdapter } from './CompatibilityRegistry';
import { LegacyFeatureFlags } from '../featureflags/LegacyFeatureFlags';
import { CompareParams }      from './ICompatibilityAdapter';

export const LegacyShadowOrchestrator = {

  // Chama todos os Adapters registrados que sabem lidar com esta ação.
  // Cada Adapter recebe seu próprio legacyResult e calculatorInput,
  // montados pelo chamador (earnXP, registerRankingXP, etc.)
  async dispatchComparisons(
    actionKey: string,
    paramsBySystem: Partial<Record<string, CompareParams>>
  ): Promise<void> {
    const state = await LegacyFeatureFlags.getState();
    if (!state.ShadowModeEnabled) return; // só roda se Shadow Mode global ativo

    const systems = getRegisteredSystems();

    await Promise.all(
      systems.map(async (system) => {
        const adapter = getCompatibilityAdapter(system);
        const params  = paramsBySystem[system];
        if (!adapter || !params) return;
        if (!adapter.canHandle(actionKey)) return;

        await adapter.compare(params).catch(() => { /* nunca afeta o legado */ });
      })
    );
  },
};
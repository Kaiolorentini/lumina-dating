// ============================================
// LUMINA — ACHIEVEMENT COMPATIBILITY ADAPTER v1.1
// functions/src/gamification/compatibility/adapters/AchievementCompatibilityAdapter.ts
// SPRINT 1C — v1.1: corrige tipo de retorno com spread.
// ============================================

import { CompatibilityAdapter } from '../CompatibilityAdapter';
import { CompareParams }        from '../ICompatibilityAdapter';
import { calculateAchievements, AchievementCalculatorInput } from '../../calculators/AchievementCalculator';
import { registerCompatibilityAdapter } from '../CompatibilityRegistry';
import { ACHIEVEMENTS_BY_ACTION } from '../../../config/achievementsCatalog';

class AchievementCompatibilityAdapterImpl extends CompatibilityAdapter {
  readonly system = 'ACHIEVEMENT' as const;

  canHandle(legacyActionKey: string): boolean {
    return (ACHIEVEMENTS_BY_ACTION[legacyActionKey] ?? []).length > 0;
  }

  async simulate(params: CompareParams): Promise<Record<string, unknown> | null> {
    const input  = params.calculatorInput as unknown as AchievementCalculatorInput;
    const output = calculateAchievements(input);
    return output ? { ...output } : null;
  }
}

const instance = new AchievementCompatibilityAdapterImpl();
registerCompatibilityAdapter(instance);

export { instance as AchievementCompatibilityAdapter };
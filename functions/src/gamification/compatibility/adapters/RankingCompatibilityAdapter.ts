// ============================================
// LUMINA — RANKING COMPATIBILITY ADAPTER v2.1
// functions/src/gamification/compatibility/adapters/RankingCompatibilityAdapter.ts
// SPRINT 1C — v2.1: corrige tipo de retorno com spread.
// ============================================

import { CompatibilityAdapter } from '../CompatibilityAdapter';
import { CompareParams }        from '../ICompatibilityAdapter';
import { calculateRanking, RankingCalculatorInput } from '../../calculators/RankingCalculator';
import { registerCompatibilityAdapter } from '../CompatibilityRegistry';

const VALID_CATEGORIES = ['SOCIAL', 'MISSION', 'CHAT'];

class RankingCompatibilityAdapterImpl extends CompatibilityAdapter {
  readonly system = 'RANKING' as const;

  canHandle(legacyActionKey: string): boolean {
    return VALID_CATEGORIES.includes(legacyActionKey);
  }

  async simulate(params: CompareParams): Promise<Record<string, unknown> | null> {
    const input  = params.calculatorInput as unknown as RankingCalculatorInput;
    const output = calculateRanking(input);
    return output ? { ...output } : null;
  }
}

const instance = new RankingCompatibilityAdapterImpl();
registerCompatibilityAdapter(instance);

export { instance as RankingCompatibilityAdapter };
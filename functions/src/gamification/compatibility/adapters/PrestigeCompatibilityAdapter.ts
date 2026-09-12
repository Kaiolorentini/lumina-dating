// ============================================
// LUMINA — PRESTIGE COMPATIBILITY ADAPTER v1.1
// functions/src/gamification/compatibility/adapters/PrestigeCompatibilityAdapter.ts
// SPRINT 1C — v1.1: corrige tipo de retorno com spread.
// ============================================

import { CompatibilityAdapter } from '../CompatibilityAdapter';
import { CompareParams }        from '../ICompatibilityAdapter';
import { calculatePrestige, PrestigeCalculatorInput } from '../../calculators/PrestigeCalculator';
import { registerCompatibilityAdapter } from '../CompatibilityRegistry';

class PrestigeCompatibilityAdapterImpl extends CompatibilityAdapter {
  readonly system = 'PRESTIGE' as const;

  canHandle(legacyActionKey: string): boolean {
    return legacyActionKey === 'CREATE_SINTONIA';
  }

  async simulate(params: CompareParams): Promise<Record<string, unknown> | null> {
    const input  = params.calculatorInput as unknown as PrestigeCalculatorInput;
    const output = calculatePrestige(input);
    return output ? { ...output } : null;
  }
}

const instance = new PrestigeCompatibilityAdapterImpl();
registerCompatibilityAdapter(instance);

export { instance as PrestigeCompatibilityAdapter };
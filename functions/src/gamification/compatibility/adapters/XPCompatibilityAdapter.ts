// ============================================
// LUMINA — XP COMPATIBILITY ADAPTER v4.1
// functions/src/gamification/compatibility/adapters/XPCompatibilityAdapter.ts
//
// SPRINT 1C — v4.1: corrige tipo de retorno com spread.
// ============================================

import { CompatibilityAdapter } from '../CompatibilityAdapter';
import { CompareParams }        from '../ICompatibilityAdapter';
import { calculateXP, XPCalculatorInput } from '../../calculators/XPCalculator';
import { registerCompatibilityAdapter }   from '../CompatibilityRegistry';

const ACTION_KEYS = ['VISIT_PROFILE', 'GIVE_LIKE', 'CREATE_SINTONIA', 'START_CONVERSATION', 'COMPLETE_MISSION'];

class XPCompatibilityAdapterImpl extends CompatibilityAdapter {
  readonly system = 'XP' as const;

  canHandle(legacyActionKey: string): boolean {
    return ACTION_KEYS.includes(legacyActionKey);
  }

  async simulate(params: CompareParams): Promise<Record<string, unknown> | null> {
    const input  = params.calculatorInput as unknown as XPCalculatorInput;
    const output = calculateXP(input);
    return output ? { ...output } : null;
  }
}

const instance = new XPCompatibilityAdapterImpl();
registerCompatibilityAdapter(instance);

export { instance as XPCompatibilityAdapter };
// ============================================
// LUMINA — TREE COMPATIBILITY ADAPTER v1.1
// functions/src/gamification/compatibility/adapters/TreeCompatibilityAdapter.ts
// SPRINT 1C — v1.1: corrige tipo de retorno com spread.
// ============================================

import { CompatibilityAdapter } from '../CompatibilityAdapter';
import { CompareParams }        from '../ICompatibilityAdapter';
import { calculateTree, TreeCalculatorInput } from '../../calculators/TreeCalculator';
import { registerCompatibilityAdapter } from '../CompatibilityRegistry';

class TreeCompatibilityAdapterImpl extends CompatibilityAdapter {
  readonly system = 'TREE' as const;

  canHandle(legacyActionKey: string): boolean {
    return legacyActionKey === 'CREATE_SINTONIA';
  }

  async simulate(params: CompareParams): Promise<Record<string, unknown> | null> {
    const input  = params.calculatorInput as unknown as TreeCalculatorInput;
    const output = calculateTree(input);
    return output ? { ...output } : null;
  }
}

const instance = new TreeCompatibilityAdapterImpl();
registerCompatibilityAdapter(instance);

export { instance as TreeCompatibilityAdapter };
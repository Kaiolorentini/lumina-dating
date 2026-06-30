// ============================================
// LUMINA — TREE COMPARATOR v2.0
// functions/src/gamification/shadow/comparators/TreeComparator.ts
// ============================================

import { IShadowComparator, ComparisonResult, FieldDifference } from '../IShadowComparator';
import { DivergenceSeverity } from '../ShadowStatus';
import { registerComparator } from '../ComparatorRegistry';

class TreeComparatorImpl implements IShadowComparator {
  compare(legacy: Record<string, unknown>, engine: Record<string, unknown>): ComparisonResult {
    const differences: FieldDifference[] = [];
    const legacyXP    = (legacy.treeXP as number) ?? 0;
    const engineXP     = (engine.treeXP as number) ?? 0;
    const legacyStage = (legacy.treeStage as number) ?? 0;
    const engineStage  = (engine.treeStage as number) ?? 0;

    if (legacyXP !== engineXP) {
      differences.push({ field: 'treeXP', legacy: legacyXP, engine: engineXP, severity: DivergenceSeverity.MEDIUM });
    }
    if (legacyStage !== engineStage) {
      differences.push({ field: 'treeStage', legacy: legacyStage, engine: engineStage, severity: DivergenceSeverity.CRITICAL });
    }

    const severity =
      differences.some(d => d.severity === DivergenceSeverity.CRITICAL) ? DivergenceSeverity.CRITICAL :
      differences.length > 0                                            ? DivergenceSeverity.MEDIUM   : DivergenceSeverity.NONE;

    return { matched: differences.length === 0, differences, severity };
  }
}

registerComparator('TREE', new TreeComparatorImpl());
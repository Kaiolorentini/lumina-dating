// ============================================
// LUMINA — PRESTIGE COMPARATOR v2.0
// functions/src/gamification/shadow/comparators/PrestigeComparator.ts
// ============================================

import { IShadowComparator, ComparisonResult, FieldDifference } from '../IShadowComparator';
import { DivergenceSeverity } from '../ShadowStatus';
import { registerComparator } from '../ComparatorRegistry';

class PrestigeComparatorImpl implements IShadowComparator {
  compare(legacy: Record<string, unknown>, engine: Record<string, unknown>): ComparisonResult {
    const differences: FieldDifference[] = [];
    const legacyPoints = (legacy.prestigePoints as number) ?? 0;
    const enginePoints  = (engine.prestigePoints as number) ?? 0;
    const legacyStage  = (legacy.stage as number) ?? 0;
    const engineStage   = (engine.stage as number) ?? 0;

    if (legacyPoints !== enginePoints) {
      differences.push({ field: 'prestigePoints', legacy: legacyPoints, engine: enginePoints, severity: DivergenceSeverity.MEDIUM });
    }
    if (legacyStage !== engineStage) {
      differences.push({ field: 'stage', legacy: legacyStage, engine: engineStage, severity: DivergenceSeverity.CRITICAL });
    }

    const severity =
      differences.some(d => d.severity === DivergenceSeverity.CRITICAL) ? DivergenceSeverity.CRITICAL :
      differences.length > 0                                            ? DivergenceSeverity.MEDIUM   : DivergenceSeverity.NONE;

    return { matched: differences.length === 0, differences, severity };
  }
}

registerComparator('PRESTIGE', new PrestigeComparatorImpl());
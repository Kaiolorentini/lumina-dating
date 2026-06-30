// ============================================
// LUMINA — ACHIEVEMENT COMPARATOR v2.0
// functions/src/gamification/shadow/comparators/AchievementComparator.ts
// ============================================

import { IShadowComparator, ComparisonResult, FieldDifference } from '../IShadowComparator';
import { DivergenceSeverity } from '../ShadowStatus';
import { registerComparator } from '../ComparatorRegistry';

class AchievementComparatorImpl implements IShadowComparator {
  compare(legacy: Record<string, unknown>, engine: Record<string, unknown>): ComparisonResult {
    const differences: FieldDifference[] = [];
    const legacySet = new Set((legacy.unlockedIds as string[]) ?? []);
    const engineSet  = new Set((engine.unlockedIds as string[]) ?? []);

    const onlyInLegacy = [...legacySet].filter(id => !engineSet.has(id));
    const onlyInEngine = [...engineSet].filter(id => !legacySet.has(id));

    if (onlyInLegacy.length > 0) {
      differences.push({ field: 'unlockedIds (missing in engine)', legacy: onlyInLegacy, engine: [], severity: DivergenceSeverity.CRITICAL });
    }
    if (onlyInEngine.length > 0) {
      differences.push({ field: 'unlockedIds (extra in engine)', legacy: [], engine: onlyInEngine, severity: DivergenceSeverity.CRITICAL });
    }

    const severity = differences.length > 0 ? DivergenceSeverity.CRITICAL : DivergenceSeverity.NONE;
    return { matched: differences.length === 0, differences, severity };
  }
}

registerComparator('ACHIEVEMENT', new AchievementComparatorImpl());
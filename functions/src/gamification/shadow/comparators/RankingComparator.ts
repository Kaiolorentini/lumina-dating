// ============================================
// LUMINA — RANKING COMPARATOR v2.0
// functions/src/gamification/shadow/comparators/RankingComparator.ts
// ============================================

import { IShadowComparator, ComparisonResult, FieldDifference } from '../IShadowComparator';
import { DivergenceSeverity } from '../ShadowStatus';
import { registerComparator } from '../ComparatorRegistry';

const XP_TOLERANCE = 1;

class RankingComparatorImpl implements IShadowComparator {
  compare(legacy: Record<string, unknown>, engine: Record<string, unknown>): ComparisonResult {
    const differences: FieldDifference[] = [];
    const legacySocial = (legacy.socialXP as number) ?? 0;
    const engineSocial  = (engine.socialXP as number) ?? 0;
    const legacyWeekly  = (legacy.weeklyXP as number) ?? 0;
    const engineWeekly   = (engine.weeklyXP as number) ?? 0;
    const legacyLeague  = legacy.league as string;
    const engineLeague   = engine.league as string;

    const socialDiff = Math.abs(legacySocial - engineSocial);
    if (socialDiff > XP_TOLERANCE) {
      differences.push({ field: 'socialXP', legacy: legacySocial, engine: engineSocial, severity: socialDiff > 20 ? DivergenceSeverity.CRITICAL : DivergenceSeverity.MEDIUM });
    }

    const weeklyDiff = Math.abs(legacyWeekly - engineWeekly);
    if (weeklyDiff > XP_TOLERANCE) {
      differences.push({ field: 'weeklyXP', legacy: legacyWeekly, engine: engineWeekly, severity: weeklyDiff > 20 ? DivergenceSeverity.CRITICAL : DivergenceSeverity.LOW });
    }

    if (legacyLeague !== engineLeague) {
      differences.push({ field: 'league', legacy: legacyLeague, engine: engineLeague, severity: DivergenceSeverity.CRITICAL });
    }

    const severity =
      differences.some(d => d.severity === DivergenceSeverity.CRITICAL) ? DivergenceSeverity.CRITICAL :
      differences.some(d => d.severity === DivergenceSeverity.MEDIUM)   ? DivergenceSeverity.MEDIUM   :
      differences.length > 0                                            ? DivergenceSeverity.LOW      : DivergenceSeverity.NONE;

    return { matched: differences.length === 0, differences, severity };
  }
}

registerComparator('RANKING', new RankingComparatorImpl());
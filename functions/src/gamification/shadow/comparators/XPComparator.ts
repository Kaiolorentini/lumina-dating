// ============================================
// LUMINA — XP COMPARATOR v2.0
// functions/src/gamification/shadow/comparators/XPComparator.ts
//
// SPRINT 1C — v2.0: implementa IShadowComparator, auto-registra.
// ============================================

import { IShadowComparator, ComparisonResult, FieldDifference } from '../IShadowComparator';
import { DivergenceSeverity } from '../ShadowStatus';
import { registerComparator } from '../ComparatorRegistry';

const XP_TOLERANCE = 1;

class XPComparatorImpl implements IShadowComparator {
  compare(legacy: Record<string, unknown>, engine: Record<string, unknown>): ComparisonResult {
    const differences: FieldDifference[] = [];
    const legacyXP    = (legacy.xpAmount as number) ?? 0;
    const engineXP     = (engine.xpAmount as number) ?? 0;
    const legacyNewXP = (legacy.newXP as number) ?? 0;
    const engineNewXP  = (engine.newXP as number) ?? 0;
    const legacyLevel = (legacy.newLevel as number) ?? 0;
    const engineLevel  = (engine.newLevel as number) ?? 0;

    const xpDiff = Math.abs(legacyXP - engineXP);
    if (xpDiff > XP_TOLERANCE) {
      differences.push({ field: 'xpAmount', legacy: legacyXP, engine: engineXP, severity: xpDiff > 10 ? DivergenceSeverity.CRITICAL : DivergenceSeverity.MEDIUM });
    }

    if (legacyLevel !== engineLevel) {
      differences.push({ field: 'newLevel', legacy: legacyLevel, engine: engineLevel, severity: DivergenceSeverity.CRITICAL });
    }

    const totalDiff = Math.abs(legacyNewXP - engineNewXP);
    if (totalDiff > XP_TOLERANCE) {
      differences.push({ field: 'newXP', legacy: legacyNewXP, engine: engineNewXP, severity: totalDiff > 50 ? DivergenceSeverity.CRITICAL : DivergenceSeverity.LOW });
    }

    const severity =
      differences.some(d => d.severity === DivergenceSeverity.CRITICAL) ? DivergenceSeverity.CRITICAL :
      differences.some(d => d.severity === DivergenceSeverity.MEDIUM)   ? DivergenceSeverity.MEDIUM   :
      differences.length > 0                                            ? DivergenceSeverity.LOW      : DivergenceSeverity.NONE;

    return { matched: differences.length === 0, differences, severity };
  }
}

registerComparator('XP', new XPComparatorImpl());
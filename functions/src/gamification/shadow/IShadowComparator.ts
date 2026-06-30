// ============================================
// LUMINA — ISHADOW COMPARATOR v1.0
// functions/src/gamification/shadow/IShadowComparator.ts
//
// SPRINT 1C — Interface única para todos os comparadores.
// ============================================

import { DivergenceSeverity } from './ShadowStatus';

export interface FieldDifference {
  field:    string;
  legacy:   unknown;
  engine:   unknown;
  severity: DivergenceSeverity;
}

export interface ComparisonResult {
  matched:     boolean;
  differences: FieldDifference[];
  severity:    DivergenceSeverity;
}

export interface IShadowComparator {
  compare(legacy: Record<string, unknown>, engine: Record<string, unknown>): ComparisonResult;
}
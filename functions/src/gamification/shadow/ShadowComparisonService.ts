// ============================================
// LUMINA — SHADOW COMPARISON SERVICE v1.0
// functions/src/gamification/shadow/ShadowComparisonService.ts
//
// SPRINT 0 — Compara resultado legado vs Engine
// sem aplicar efeito do Engine. Apenas observa.
// Base para o Shadow Comparison Score (Sprint 1C).
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

export type ShadowSystem = 'XP' | 'RANKING' | 'ACHIEVEMENT' | 'VAULT';

export interface ShadowComparisonInput {
  system:        ShadowSystem;
  uid:           string;
  eventId:       string;
  legacyResult:  Record<string, unknown>;
  engineResult:  Record<string, unknown>;
}

export interface ShadowComparisonResult {
  matched:      boolean;
  divergences:  string[];
}

// Compara campos relevantes entre legado e Engine
function compareResults(
  legacy: Record<string, unknown>,
  engine: Record<string, unknown>,
  keysToCompare: string[]
): ShadowComparisonResult {
  const divergences: string[] = [];

  for (const key of keysToCompare) {
    const legacyVal = legacy[key];
    const engineVal = engine[key];
    if (legacyVal !== engineVal) {
      divergences.push(`${key}: legacy=${legacyVal} engine=${engineVal}`);
    }
  }

  return { matched: divergences.length === 0, divergences };
}

const COMPARISON_KEYS: Record<ShadowSystem, string[]> = {
  XP:          ['xpAmount', 'newLevel'],
  RANKING:     ['socialXP', 'weeklyXP'],
  ACHIEVEMENT: ['unlockedCount'],
  VAULT:       ['fragmentsDeposited'],
};

export const ShadowComparisonService = {

  async compare(input: ShadowComparisonInput): Promise<ShadowComparisonResult> {
    const keys   = COMPARISON_KEYS[input.system];
    const result = compareResults(input.legacyResult, input.engineResult, keys);

    // Grava resultado para o dashboard e Comparison Score
    await db.collection('shadowComparisons').add({
      system:       input.system,
      uid:          input.uid,
      eventId:      input.eventId,
      matched:      result.matched,
      divergences:  result.divergences,
      legacyResult: input.legacyResult,
      engineResult: input.engineResult,
      timestamp:    FieldValue.serverTimestamp(),
    }).catch(() => { /* shadow nunca bloqueia o fluxo principal */ });

    return result;
  },

  // Calcula o Comparison Score de um sistema nas últimas N horas
  async getComparisonScore(system: ShadowSystem, hoursWindow = 72): Promise<number> {
    const since = new Date(Date.now() - hoursWindow * 3600_000);
    const snap  = await db.collection('shadowComparisons')
      .where('system', '==', system)
      .where('timestamp', '>=', since)
      .limit(5000)
      .get();

    if (snap.empty) return 100; // sem dados = considera ok (nada para divergir)

    const total   = snap.size;
    const matched = snap.docs.filter(d => d.data().matched === true).length;

    return (matched / total) * 100;
  },
};
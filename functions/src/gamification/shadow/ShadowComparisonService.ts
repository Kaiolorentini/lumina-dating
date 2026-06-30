// ============================================
// LUMINA — SHADOW COMPARISON SERVICE v3.0
// functions/src/gamification/shadow/ShadowComparisonService.ts
//
// SPRINT 1C — v3.0: responsabilidade ÚNICA: gravar o resultado
// de uma comparação já realizada pelo ShadowCollector.
// Não compara. Não agrega métricas (isso é ShadowMetricsService).
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ShadowStatus, ShadowSystem, DivergenceSeverity } from './ShadowStatus';
import { FieldDifference } from './IShadowComparator';

const db = admin.firestore();

export interface RecordRawInput {
  system:       ShadowSystem;
  uid:          string;
  eventId:      string;
  legacyResult: Record<string, unknown>;
  engineResult: Record<string, unknown>;
  status:       ShadowStatus;
  differences:  FieldDifference[];
  severity:     DivergenceSeverity | 'NONE';
}

export const ShadowComparisonService = {

  // REGRA 9: nunca lança erro — falha aqui não pode afetar o legado.
  async recordRaw(input: RecordRawInput): Promise<void> {
    try {
      await db.collection('shadowComparisons').add({
        ...input,
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch {
      // silencioso por design
    }
  },
};
// ============================================
// LUMINA — SHADOW COLLECTOR v1.0
// functions/src/gamification/shadow/ShadowCollector.ts
//
// SPRINT 1C — Responsabilidade ÚNICA: coletar o par
// (legacyResult, engineResult) e encaminhar para comparação.
// Não compara. Não agrega métricas. Só orquestra a coleta.
// ============================================

import { CompatibilityResult } from '../compatibility/ICompatibilityAdapter';
import { ShadowComparisonService } from './ShadowComparisonService';
import { getComparator } from './ComparatorRegistry';
import { ShadowStatus } from './ShadowStatus';

export const ShadowCollector = {

  // Recebe o resultado bruto do Adapter e aciona a comparação.
  // REGRA 9: nunca lança erro.
  async collect(result: CompatibilityResult): Promise<void> {
    if (!result.legacyResult || !result.engineResult) {
      return; // REGRA 1: nunca compara com um lado vazio
    }

    const comparator = getComparator(result.system);
    if (!comparator) {
      await ShadowComparisonService.recordRaw({
        system: result.system, uid: result.uid, eventId: result.eventId,
        legacyResult: result.legacyResult, engineResult: result.engineResult,
        status: ShadowStatus.NOT_SUPPORTED, differences: [], severity: 'NONE',
      });
      return;
    }

    try {
      const comparison = comparator.compare(result.legacyResult, result.engineResult);
      await ShadowComparisonService.recordRaw({
        system: result.system, uid: result.uid, eventId: result.eventId,
        legacyResult: result.legacyResult, engineResult: result.engineResult,
        status: comparison.matched ? ShadowStatus.MATCH : ShadowStatus.DIFFERENT,
        differences: comparison.differences, severity: comparison.severity,
      });
    } catch {
      await ShadowComparisonService.recordRaw({
        system: result.system, uid: result.uid, eventId: result.eventId,
        legacyResult: result.legacyResult, engineResult: result.engineResult,
        status: ShadowStatus.ERROR, differences: [], severity: 'NONE',
      }).catch(() => {});
    }
  },
};
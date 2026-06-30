// ============================================
// LUMINA — COMPATIBILITY ADAPTER (BASE) v2.0
// functions/src/gamification/compatibility/CompatibilityAdapter.ts
//
// SPRINT 1C — v2.0: base para Adapters de comparação pura.
// Nunca cria GameEvents. Nunca grava EventLedger.
// Nunca chama Dispatchers. Nunca persiste dados.
// ============================================

import { CompatibilityResult, CompareParams, ICompatibilityAdapter } from './ICompatibilityAdapter';
import { ShadowSystem }    from '../shadow/ShadowStatus';
import { ShadowCollector } from '../shadow/ShadowCollector';

export abstract class CompatibilityAdapter implements ICompatibilityAdapter {
  abstract readonly system: ShadowSystem;

  abstract canHandle(legacyActionKey: string): boolean;

  // Subclasses calculam o resultado puro via Calculator (sem Firestore)
  abstract simulate(params: CompareParams): Promise<Record<string, unknown> | null>;

  async compare(params: CompareParams): Promise<CompatibilityResult> {
    const base: CompatibilityResult = {
      system:           this.system,
      eventId:          params.eventId,
      uid:              params.uid,
      legacyResult:     params.legacyResult,
      engineResult:     null,
      comparisonStatus: 'SKIPPED',
      timestamp:        new Date().toISOString(),
    };

    if (!this.canHandle(params.legacyActionKey)) {
      return base;
    }

    try {
      const engineResult = await this.simulate(params);
      base.engineResult = engineResult;
      base.comparisonStatus = engineResult ? 'PENDING' : 'SKIPPED';

      if (engineResult) {
        await ShadowCollector.collect(base).catch(() => { /* nunca afeta o legado */ });
      }

      return base;
    } catch {
      // REGRA 9: falha no Adapter nunca propaga para o legado
      return base;
    }
  }
}
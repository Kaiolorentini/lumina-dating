// ============================================
// LUMINA — ICOMPATIBILITY ADAPTER v2.0
// functions/src/gamification/compatibility/ICompatibilityAdapter.ts
//
// SPRINT 1C — v2.0: Adapter de COMPARAÇÃO, não de execução.
// Nunca cria GameEvents. Nunca grava EventLedger.
// Nunca chama Dispatchers. Nunca persiste dados.
// Apenas compara legacyResult com o cálculo puro do Calculator.
// ============================================

import { ShadowSystem } from '../shadow/ShadowStatus';

export interface CompatibilityResult {
  system:           ShadowSystem;
  eventId:          string;
  uid:              string;
  legacyResult:     Record<string, unknown> | null;
  engineResult:     Record<string, unknown> | null;
  comparisonStatus: 'PENDING' | 'SKIPPED';
  timestamp:        string;
}

export interface CompareParams {
  uid:             string;
  eventId:         string; // gerado pelo legado para correlação — não é um GameEvent
  legacyActionKey: string;
  legacyResult:    Record<string, unknown>; // sempre obrigatório
  calculatorInput: Record<string, unknown>; // dados necessários para o Calculator simular
}

// Interface única para todos os Adapters de comparação
export interface ICompatibilityAdapter {
  readonly system: ShadowSystem;

  canHandle(legacyActionKey: string): boolean;

  // Único método: compara legado vs Calculator puro.
  // Nunca lança erro. Nunca toca no Engine real.
  compare(params: CompareParams): Promise<CompatibilityResult>;
}
// ============================================
// LUMINA — SINTONIA ENGINE v5.1
// src/utils/sintoniaEngine.ts
//
// CORREÇÃO: adiciona getSintoniaColor e getSintoniaLabel
// + alias calcularSintoniaIA para compatibilidade
// ============================================

export {
  calcularSintonia,
  calcularSintonia as calcularSintoniaIA,
} from '../modules/ai/services/sintoniaCalculator';

export type {
  SintoniaResult,
  SintoniaBreakdown,
} from '../modules/ai/services/sintoniaCalculator';

export {
  getSintoniaColor,
  getSintoniaLabel,
  getSintoniaMilestone,
  getSintoniaIncreaseMessage,
} from '../shared/utils/sintonia';
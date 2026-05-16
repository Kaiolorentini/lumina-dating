// Compatibilidade — re-exporta do módulo novo
export {
  calcularSintonia,
  calcularSintoniaIA,
} from '../modules/ai/services/sintoniaCalculator';

export type {
  SintoniaResult,
  SintoniaBreakdown,
} from '../modules/ai/services/sintoniaCalculator';

export {
  getSintoniaLabel,
  getSintoniaColor,
  getSintoniaMilestone as getMilestone,
} from '../shared/utils/sintonia';
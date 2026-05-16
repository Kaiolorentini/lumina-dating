export { AI_MODELS } from './data/aiModels';
export type { AIModel } from './data/aiModels';
export { calcularSintonia, calcularSintoniaIA } from './services/sintoniaCalculator';
export {
  getConnection,
  registerVisit,
  registerMessage,
  registerTimeSpent,
} from './services/sintoniaService';
export { useSintonia } from './hooks/useSintonia';
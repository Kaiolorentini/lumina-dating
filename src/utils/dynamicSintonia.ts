// Compatibilidade — re-exporta do módulo novo
export {
  getConnection,
  registerVisit,
  registerMessage,
  registerTimeSpent,
} from '../modules/ai/services/sintoniaService';

export {
  getSintoniaMilestone as getMilestone,
  getSintoniaIncreaseMessage,
} from '../shared/utils/sintonia';
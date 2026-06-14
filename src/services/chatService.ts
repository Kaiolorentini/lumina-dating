// ============================================
// COMPATIBILIDADE — NÃO REMOVER
// Re-exporta do módulo de chat.
// ============================================
export {
  sendMessage,
  listenToMessages,
  generateChatId,
} from '../modules/chat/services/messageService';

export type { ChatMessage as Message } from '../shared/types';
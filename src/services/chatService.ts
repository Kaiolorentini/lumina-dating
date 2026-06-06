
export {
  sendMessage,
  listenToMessages,
  generateAIChatId as getChatId,
  generateAIChatId,
  generateChatId,
} from '../modules/chat/services/messageService';

// Tipos — compatibilidade com imports antigos
export type { ChatMessage as Message } from '../shared/types';
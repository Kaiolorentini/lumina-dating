// ============================================
// LUMINA — CHAT MODULE INDEX v5.1
// src/modules/chat/index.ts
//
// CORREÇÃO: IA removida do projeto.
// useAIChat, aiResponseService, autoMessageService
// e ChatScreen de IA removidos.
// Apenas UserChatScreen e useUserChat exportados.
// ============================================

export { default as ChatScreen } from './screens/UserChatScreen';
export { useUserChat }           from './hooks/useChat';
export { sendMessage, listenToMessages } from './services/messageService';
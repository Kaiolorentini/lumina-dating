export { default as ChatScreen } from './screens/ChatScreen';
export { useAIChat, useUserChat } from './hooks/useChat';
export { sendMessage, listenToMessages } from './services/messageService';
export { generateAIResponse, getTypingDelay } from './services/aiResponseService';
export { dispararMensagemAutomatica } from './services/autoMessageService';
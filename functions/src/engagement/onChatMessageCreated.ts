// ============================================
// LUMINA — MENSAGEM CRIADA
// functions/src/engagement/onChatMessageCreated.ts
//
// Registra as missões de mensagem a partir do documento REAL
// gravado em chats/{chatId}/messages — o app não declara nada.
//   send_message: texto com 10+ caracteres
//   long_chat:    cada mensagem conta (texto ou áudio)
//
// As rules já garantem que senderId é quem gravou e que ele é
// membro do chat. Custo: uma execução curta por mensagem.
// ============================================

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { MissionService } from '../gamification/services/MissionService';

const MIN_MESSAGE_LENGTH = 10;

export const onChatMessageCreated = onDocumentCreated(
  { document: 'chats/{chatId}/messages/{messageId}', region: 'us-central1' },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const senderId = data.senderId;
    if (typeof senderId !== 'string' || !senderId) return;

    const text = typeof data.text === 'string' ? data.text.trim() : '';

    if (text.length >= MIN_MESSAGE_LENGTH) {
      await MissionService.recordEvent(senderId, 'send_message')
        .catch(error => console.warn('[onChatMessageCreated] send_message falhou:', error));
    }

    await MissionService.recordEvent(senderId, 'long_chat')
      .catch(error => console.warn('[onChatMessageCreated] long_chat falhou:', error));
  },
);
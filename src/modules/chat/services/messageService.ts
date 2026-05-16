import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';
import { ChatMessage } from '../../../shared/types';
import { generateAIChatId, generateChatId } from '../../../shared/utils';

// ============================================
// MESSAGE SERVICE — MÓDULO CHAT
// ============================================

export { generateAIChatId, generateChatId };

// Envia mensagem
export async function sendMessage(
  chatId: string,
  text: string,
  senderId: string,
  senderName: string,
  isAI: boolean = false,
  recipientId?: string
): Promise<void> {
  const messagesRef = collection(
    db,
    COLLECTIONS.CHATS,
    chatId,
    COLLECTIONS.MESSAGES
  );

  await addDoc(messagesRef, {
    text,
    senderId,
    senderName,
    isAI,
    timestamp: serverTimestamp(),
  });

  // Atualiza resumo do chat
  const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
  await setDoc(chatRef, {
    lastMessage: text,
    lastMessageTime: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // Push para destinatário (apenas chat entre usuários reais)
  if (recipientId && !isAI) {
    try {
      const { sendPushToUser } = await import(
        '../../notifications/services/pushService'
      );
      await sendPushToUser(
        recipientId,
        `💬 ${senderName}`,
        text.length > 50 ? text.slice(0, 50) + '...' : text
      );
    } catch (error) {
      console.error('Erro ao enviar push de mensagem:', error);
    }
  }
}

// Escuta mensagens em tempo real
export function listenToMessages(
  chatId: string,
  onMessages: (messages: ChatMessage[]) => void
): () => void {
  const messagesRef = collection(
    db,
    COLLECTIONS.CHATS,
    chatId,
    COLLECTIONS.MESSAGES
  );
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  return onSnapshot(q, snapshot => {
    const messages: ChatMessage[] = snapshot.docs.map(doc => ({
      id: doc.id,
      text: doc.data().text,
      senderId: doc.data().senderId,
      senderName: doc.data().senderName,
      timestamp: doc.data().timestamp?.toDate() || new Date(),
      isAI: doc.data().isAI,
    }));
    onMessages(messages);
  });
}
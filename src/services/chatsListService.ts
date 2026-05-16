import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { AI_MODELS, AIModel } from '../utils/aiModels';
import { getChatId } from './chatService';

// ============================================
// Busca todos os chats que o usuário já abriu
// Verifica quais IAs já têm mensagens salvas
// ============================================

export interface ChatPreview {
  aiModel: AIModel;
  lastMessage: string;
  lastMessageTime: Date | null;
  unread: boolean;
}

export async function getUserChats(userId: string): Promise<ChatPreview[]> {
  const chats: ChatPreview[] = [];

  for (const model of AI_MODELS) {
    const chatId = getChatId(userId, model.id);

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const lastDoc = snap.docs[0];
        chats.push({
          aiModel: model,
          lastMessage: lastDoc.data().text || '',
          lastMessageTime: lastDoc.data().timestamp?.toDate() || null,
          unread: lastDoc.data().isAI === true,
        });
      }
    } catch (error) {
      console.error(`Erro ao buscar chat ${chatId}:`, error);
    }
  }

  // Ordena por mais recente
  chats.sort((a, b) => {
    if (!a.lastMessageTime) return 1;
    if (!b.lastMessageTime) return -1;
    return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
  });

  return chats;
}

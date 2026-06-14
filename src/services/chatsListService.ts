// ============================================
// CHATS LIST SERVICE
//
// Busca conversas reais entre usuários conectados.
// ============================================

import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../core/firebase';
import { COLLECTIONS } from '../core/constants';
import { generateChatId } from '../modules/chat/services/messageService';
import { getConexoesAceitas } from '../modules/profile/services/requestsService';
import { getProfile } from './profileService';

export interface UserChatPreview {
  userId: string;
  userName: string;
  userPhoto: string;
  lastMessage: string;
  lastMessageTime: Date | null;
  unreadCount: number;
}

async function getLastMessage(
  uid1: string,
  uid2: string
): Promise<{ text: string; timestamp: Date | null; senderId: string } | null> {
  try {
    const chatId = generateChatId(uid1, uid2);
    const messagesRef = collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES);
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return {
      text: data.audioUrl ? '🎤 Mensagem de áudio' : data.text || '',
      timestamp: data.timestamp?.toDate() || null,
      senderId: data.senderId,
    };
  } catch {
    return null;
  }
}

export async function getUserConversations(
  currentUserId: string
): Promise<UserChatPreview[]> {
  const connections = await getConexoesAceitas(currentUserId);
  const previews: UserChatPreview[] = [];

  await Promise.all(
    connections.map(async conn => {
      const otherUserId =
        conn.fromUserId === currentUserId ? conn.toUserId : conn.fromUserId;
      try {
        const [profile, lastMsg] = await Promise.all([
          getProfile(otherUserId),
          getLastMessage(currentUserId, otherUserId),
        ]);

        if (profile) {
          previews.push({
            userId: otherUserId,
            userName: profile.name,
            userPhoto: profile.photoURL || '',
            lastMessage: lastMsg?.text || 'Toque para conversar',
            lastMessageTime: lastMsg?.timestamp || null,
            unreadCount: 0,
          });
        }
      } catch (e) {
        console.error('[chatsListService] Erro ao buscar conversa:', e);
      }
    })
  );

  return previews.sort((a, b) => {
    if (!a.lastMessageTime) return 1;
    if (!b.lastMessageTime) return -1;
    return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
  });
}
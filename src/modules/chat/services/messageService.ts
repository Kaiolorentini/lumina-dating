import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';
import { ChatMessage } from '../../../shared/types';
import { generateChatId } from '../../../shared/utils';

export { generateChatId };

export async function sendMessage(
  chatId: string,
  text: string,
  senderId: string,
  senderName: string,
  recipientId?: string,
  audioUrl?: string,
  audioDuration?: number
): Promise<void> {
  const messagesRef = collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES);
  const now = new Date();

  const messageData: Record<string, unknown> = {
    text,
    senderId,
    senderName,
    timestamp: now,
    delivered: false,
    read: false,
  };

  if (audioUrl) {
    messageData.audioUrl = audioUrl;
    messageData.audioDuration = audioDuration || 0;
  }

  await addDoc(messagesRef, messageData);

  const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
  await setDoc(chatRef, {
    lastMessage: audioUrl ? '🎤 Áudio' : text,
    lastMessageTime: now,
    updatedAt: now,
    participants: recipientId ? [senderId, recipientId] : [senderId],
  }, { merge: true });

  if (recipientId) {
    try {
      await markAsDelivered(chatId, senderId);
      const { sendPushToUser } = await import('../../notifications/services/pushService');
      await sendPushToUser(
        recipientId,
        senderName,
        audioUrl
          ? '🎤 Mensagem de áudio'
          : text.length > 50
          ? text.slice(0, 50) + '...'
          : text,
        { type: 'message', chatId, senderId, senderName }
      );
    } catch (error) {
      console.error('Erro ao enviar push:', error);
    }
  }
}

export async function markAsDelivered(
  chatId: string,
  excludeSenderId: string
): Promise<void> {
  try {
    const messagesRef = collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES);
    const q = query(
      messagesRef,
      where('delivered', '==', false),
      where('senderId', '!=', excludeSenderId)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { delivered: true }));
    await batch.commit();
  } catch (e) {
    console.warn('Erro ao marcar como entregue:', e);
  }
}

export async function markAsRead(
  chatId: string,
  currentUserId: string
): Promise<void> {
  try {
    const messagesRef = collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES);
    const q = query(
      messagesRef,
      where('read', '==', false),
      where('senderId', '!=', currentUserId)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { delivered: true, read: true }));
    await batch.commit();
  } catch (e) {
    console.warn('Erro ao marcar como lido:', e);
  }
}

export function listenToMessages(
  chatId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError?: (error: { code: string; message: string }) => void
): () => void {
  const messagesRef = collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES);
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  return onSnapshot(
    q,
    snapshot => {
      const messages: ChatMessage[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          text: data.text || '',
          senderId: data.senderId,
          senderName: data.senderName,
          timestamp: data.timestamp?.toDate?.() || new Date(),
          delivered: data.delivered ?? false,
          read: data.read ?? false,
          audioUrl: data.audioUrl,
          audioDuration: data.audioDuration,
          reactions: data.reactions,
        };
      });
      onMessages(messages);
    },
    (error: { code: string; message: string }) => {
      console.error('[CHAT_ERROR] onSnapshot:', error.code, error.message);
      if (onError) onError(error);
    }
  );
}
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';

export function setTyping(chatId: string, userId: string, isTyping: boolean) {
  const ref = doc(db, COLLECTIONS.CHATS, chatId, 'typing', userId);
  setDoc(ref, {
    isTyping,
    updatedAt: serverTimestamp(),
  }, { merge: true }).catch(console.error);
}

export function listenToTyping(
  chatId: string,
  otherUserId: string,
  onTyping: (isTyping: boolean) => void
): () => void {
  const ref = doc(db, COLLECTIONS.CHATS, chatId, 'typing', otherUserId);
  return onSnapshot(ref, snap => {
    if (!snap.exists()) return onTyping(false);
    const data = snap.data();
    const updatedAt = data?.updatedAt?.toDate();
    const isRecent = updatedAt && (new Date().getTime() - updatedAt.getTime()) < 5000;
    onTyping(data?.isTyping === true && isRecent);
  });
}

export function addReaction(
  chatId: string,
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> {
  const ref = doc(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES, messageId);
  return setDoc(ref, {
    reactions: { [userId]: emoji },
  }, { merge: true });
}
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch,
  getDocs,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';
import { NotificationType, AppNotification } from '../../../shared/types';

// ============================================
// NOTIFICATION SERVICE — MÓDULO NOTIFICATIONS
// ============================================

export function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    sintonia:           '✦',
    mensagem:           '💬',
    promocao:           '💰',
    creator_approved:   '🎨',
    creator_rejected:   '❌',
    product_approved:   '✅',
    product_rejected:   '❌',
    withdrawal_approved: '💸',
    withdrawal_rejected: '❌',
    withdrawal_paid:    '💰',
    refund_processed:   '↩️',
  };
  return icons[type] || '🔔';
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  message: string
): Promise<void> {
  try {
    await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
      userId,
      type,
      message,
      read: false,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
  }
}

export function listenToNotifications(
  userId: string,
  onUpdate: (notifications: AppNotification[]) => void
): () => void {
  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(50)
  );

  return onSnapshot(q, snapshot => {
    const notifications: AppNotification[] = snapshot.docs.map(d => ({
      id: d.id,
      userId: d.data().userId,
      type: d.data().type,
      message: d.data().message,
      read: d.data().read,
      timestamp: d.data().timestamp?.toDate() || new Date(),
      icon: getNotificationIcon(d.data().type),
    }));
    onUpdate(notifications);
  });
}

export async function markAsRead(notificationId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
  await updateDoc(ref, { read: true });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('userId', '==', userId),
    where('read', '==', false)
  );
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}
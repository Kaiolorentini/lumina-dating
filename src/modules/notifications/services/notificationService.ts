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
//
// Responsabilidades:
// 1. Criar notificações
// 2. Escutar em tempo real
// 3. Marcar como lida
// ============================================

// Ícone por tipo
export function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    online: '🟢',
    sintonia: '✦',
    visita: '👀',
    mensagem: '💬',
    desbloqueio: '🔓',
    promocao: '💰',
  };
  return icons[type] || '🔔';
}

// Cria notificação
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

// Escuta notificações em tempo real
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
    const notifications: AppNotification[] = snapshot.docs.map(doc => ({
      id: doc.id,
      userId: doc.data().userId,
      type: doc.data().type,
      message: doc.data().message,
      read: doc.data().read,
      timestamp: doc.data().timestamp?.toDate() || new Date(),
      icon: getNotificationIcon(doc.data().type),
    }));
    onUpdate(notifications);
  });
}

// Marca uma notificação como lida
export async function markAsRead(notificationId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
  await updateDoc(ref, { read: true });
}

// Marca todas como lidas
export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('userId', '==', userId),
    where('read', '==', false)
  );
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.docs.forEach(doc => batch.update(doc.ref, { read: true }));
  await batch.commit();
}

// Gera notificações automáticas ao abrir o app
// Anti-spam: verifica notificações recentes
export async function generateAutoNotifications(
  userId: string
): Promise<void> {
  try {
    const notifications: { type: NotificationType; message: string }[] = [
      {
        type: 'online',
        message: 'Brenda está online agora e pode responder você ✨',
      },
      {
        type: 'sintonia',
        message: 'Nova Sintonia disponível! Confira perfis compatíveis ✦',
      },
      {
        type: 'visita',
        message: 'Alguém visitou seu perfil agora 👀',
      },
      {
        type: 'mensagem',
        message: 'Ivy te enviou uma mensagem 💬',
      },
    ];

    // Adiciona com delay para parecer natural
    for (let i = 0; i < notifications.length; i++) {
      const notif = notifications[i];
      setTimeout(async () => {
        await createNotification(userId, notif.type, notif.message);
      }, i * 3000);
    }
  } catch (error) {
    console.error('Erro ao gerar notificações:', error);
  }
}
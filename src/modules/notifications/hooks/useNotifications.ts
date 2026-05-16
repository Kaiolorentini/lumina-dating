import { useState, useEffect } from 'react';
import {
  listenToNotifications,
  markAsRead,
  markAllAsRead,
} from '../services/notificationService';
import { AppNotification } from '../../../shared/types';

// ============================================
// useNotifications
//
// Escuta notificações em tempo real.
// Reutilizável em qualquer tela.
// ============================================

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(
  userId: string | undefined
): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const unsubscribe = listenToNotifications(userId, notifs => {
      setNotifications(notifs);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  async function markRead(id: string) {
    await markAsRead(id);
  }

  async function markAllRead() {
    if (!userId) return;
    await markAllAsRead(userId);
  }

  return {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
  };
}
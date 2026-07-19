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
  error: boolean;
  reload: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(
  userId: string | undefined
): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setError(false);
    const unsubscribe = listenToNotifications(
      userId,
      notifs => {
        setNotifications(notifs);
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userId, reloadKey]);

  const unreadCount = notifications.filter(n => !n.read).length;

  async function markRead(id: string) {
    await markAsRead(id);
  }

  async function markAllRead() {
    if (!userId) return;
    await markAllAsRead(userId);
  }

  function reload() {
    setLoading(true);
    setReloadKey(k => k + 1);
  }

  return {
    notifications,
    unreadCount,
    loading,
    error,
    reload,
    markRead,
    markAllRead,
  };
}
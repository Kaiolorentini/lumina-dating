import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications } from '../services/pushService';
import { useAuth } from '../../../context/AuthContext';

// ============================================
// usePushNotifications
// ============================================

interface UsePushNotificationsReturn {
  pushToken: string | null;
  notification: Notifications.Notification | null;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user } = useAuth();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);

  useEffect(() => {
    if (!user) return;

    // Registra e obtém token
    registerForPushNotifications(user.uid).then(token => {
      if (token) setPushToken(token);
    });

    // Escuta notificações em primeiro plano
    const notifSub = Notifications.addNotificationReceivedListener(notif => {
      console.log('🔔 Notificação recebida:', notif);
      setNotification(notif);
    });

    // Escuta toque na notificação
    const responseSub =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log('👆 Notificação tocada:', response);
      });

    return () => {
      notifSub.remove();
      responseSub.remove();
    };
  }, [user]);

  return { pushToken, notification };
}
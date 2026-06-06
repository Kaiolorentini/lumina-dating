import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications } from '../services/pushService';
import { useAuth } from '../../../context/AuthContext';

interface InAppNotif {
  id: string;
  title: string;
  message: string;
  type: 'message' | 'request' | 'default';
  data?: any;
}

interface UsePushNotificationsReturn {
  pushToken: string | null;
  inAppNotif: InAppNotif | null;
  dismissInAppNotif: () => void;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user } = useAuth();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [inAppNotif, setInAppNotif] = useState<InAppNotif | null>(null);

  useEffect(() => {
    if (!user) return;

    registerForPushNotifications(user.uid).then(token => {
      if (token) setPushToken(token);
    });

    // Escuta notificações em primeiro plano — mostra modal
    const notifSub = Notifications.addNotificationReceivedListener(notif => {
      console.log('Notificacao recebida em primeiro plano:', notif);
      const data = notif.request.content.data as any;
      const title = notif.request.content.title || 'Lumina';
      const body = notif.request.content.body || '';

      setInAppNotif({
        id: notif.request.identifier,
        title,
        message: body,
        type: data?.type === 'message'
          ? 'message'
          : data?.type === 'request'
          ? 'request'
          : 'default',
        data,
      });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      response => {
        console.log('Notificacao tocada:', response);
      }
    );

    return () => {
      notifSub.remove();
      responseSub.remove();
    };
  }, [user]);

  function dismissInAppNotif() {
    setInAppNotif(null);
  }

  return { pushToken, inAppNotif, dismissInAppNotif };
}
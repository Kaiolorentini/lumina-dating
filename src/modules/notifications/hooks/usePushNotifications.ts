import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications } from '../services/pushService';
import { useAuth } from '../../../context/AuthContext';

interface InAppNotif {
  id: string;
  title: string;
  message: string;
  type: 'message' | 'request' | 'default';
  data?: Record<string, unknown>;
}

interface UsePushNotificationsReturn {
  pushToken: string | null;
  inAppNotif: InAppNotif | null;
  dismissInAppNotif: () => void;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user, hasProfile } = useAuth();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [inAppNotif, setInAppNotif] = useState<InAppNotif | null>(null);

  useEffect(() => {
    if (!user) return;

    // Só tenta salvar o token quando o perfil já existe.
    // Isso evita o savePushToken desistir (doc inexistente) e
    // garante que o token é salvo assim que hasProfile vira true.
    if (!hasProfile) return;

    registerForPushNotifications(user.uid).then(token => {
      if (token) setPushToken(token);
    });
  }, [user, hasProfile]);

  useEffect(() => {
    // Listeners de notificação — independentes do perfil
    const notifSub = Notifications.addNotificationReceivedListener(notif => {
      console.log('Notificacao recebida em primeiro plano:', notif);
      const data  = (notif.request.content.data ?? {}) as Record<string, unknown>;
      const title = notif.request.content.title || 'Lumina';
      const body  = notif.request.content.body || '';
      setInAppNotif({
        id:      notif.request.identifier,
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
  }, []);

  function dismissInAppNotif() {
    setInAppNotif(null);
  }

  return { pushToken, inAppNotif, dismissInAppNotif };
}
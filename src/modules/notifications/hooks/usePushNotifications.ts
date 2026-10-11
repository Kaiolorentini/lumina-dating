// ============================================
// LUMINA — USE PUSH NOTIFICATIONS v2.0
// src/modules/notifications/hooks/usePushNotifications.ts
//
// v2.0 (11/10/2026) — SÓ O TOKEN.
// Os dois listeners daqui saíram: o de toque só escrevia no log, e
// o de recebimento guardava um aviso (inAppNotif) que ninguém
// lia — o AppNavigator ignora o retorno deste hook. Cada push
// recebido com o app aberto re-renderizava o AppContent inteiro
// à toa. O aviso na tela e o toque são tratados SÓ no
// AppNavigator (receiveSub/tapSub).
// ============================================

import { useState, useEffect } from 'react';
import { registerForPushNotifications } from '../services/pushService';
import { useAuth } from '../../../context/AuthContext';

interface UsePushNotificationsReturn {
  pushToken: string | null;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user, hasProfile } = useAuth();
  const [pushToken, setPushToken] = useState<string | null>(null);

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

  return { pushToken };
}

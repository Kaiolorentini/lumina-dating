// ============================================
// LUMINA — ENGAGEMENT INITIALIZER v5.4
// src/components/EngagementInitializer.tsx
//
// v5.4: Verifica recompensa diária + gatilhos pendentes
// Modal de recompensa diária aparece primeiro.
// Se houver gatilhos não lidos → badge no sino.
// ============================================

import React, { useEffect, useState, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth }       from '../context/AuthContext';
import DailyRewardModal  from './DailyRewardModal';

const functions = getFunctions();

export default function EngagementInitializer() {
  const { user, loading: authLoading } = useAuth();
  const [showDailyReward, setShowDailyReward] = useState(false);
  const checkedRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading)    return;
    if (!user?.uid)     return;
    if (checkedRef.current === user.uid) return;
    checkedRef.current = user.uid;

    checkEngagements(user.uid);
  }, [user?.uid, authLoading]);

  async function checkEngagements(uid: string) {
    console.log('[EngagementInitializer] Verificando para:', uid);
    try {
      // 1. Verifica recompensa diária
      const fn = httpsCallable<void, { alreadyClaimed: boolean }>(
        functions, 'getDailyRewardStatus'
      );
      const result = await fn();
      console.log('[EngagementInitializer] alreadyClaimed:', result.data.alreadyClaimed);

      if (!result.data.alreadyClaimed) {
        setTimeout(() => setShowDailyReward(true), 1500);
      }

      // 2. Gatilhos emocionais pendentes são tratados
      // na NotificationsScreen — não abrimos modal aqui
      // para não sobrecarregar o usuário ao abrir o app.
      // O badge do sino já indica notificações não lidas.

    } catch (error) {
      console.error('[EngagementInitializer] Erro:', error);
      // Fallback: mostra modal mesmo se CF falhar
      setTimeout(() => setShowDailyReward(true), 1500);
    }
  }

  return (
    <>
      {showDailyReward && user?.uid && (
        <DailyRewardModal
          uid={user.uid}
          visible={showDailyReward}
          onClose={() => setShowDailyReward(false)}
        />
      )}
    </>
  );
}
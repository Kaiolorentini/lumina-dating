// ============================================
// LUMINA — ENGAGEMENT INITIALIZER v5.5
// src/components/EngagementInitializer.tsx
//
// v5.5 — CORREÇÕES DE ROBUSTEZ
//
// 1. FAIL-CLOSED no catch (era CRÍTICO)
//    Antes, qualquer falha (rede, cold start, permissão) caía num
//    fallback que ABRIA o modal de recompensa. Quem já resgatou
//    hoje via o modal, clicava, e a CF rejeitava por idempotência.
//    Num fluxo de economia, erro → não mostra nada.
//
// 2. getFunctions() lazy
//    No escopo do módulo, executava no import — sem garantia de
//    que initializeApp() já tinha rodado. Falha não determinística
//    no boot ("às vezes a recompensa não aparece").
//
// 3. checkedRef marcado só APÓS sucesso
//    Antes era marcado antes da chamada: uma falha transitória
//    bloqueava nova tentativa pela sessão inteira.
//
// 4. Cleanup do setTimeout
//    Logout dentro dos 1500ms causava setState em componente
//    desmontado.
//
// 5. Logs sob __DEV__, sem UID em produção.
//
// MELHORIA FUTURA (não aplicada — exige mudança de modelagem):
// esta CF roda a cada abertura do app, por usuário. Se
// lastDailyRewardAt morar no documento de wallet que o
// CoinsContext já escuta via onSnapshot, o status vem de graça:
// zero invocações, zero leituras extras.
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth }      from '../context/AuthContext';
import DailyRewardModal from './DailyRewardModal';

const REVEAL_DELAY_MS = 1500;

export default function EngagementInitializer() {
  const { user, loading: authLoading } = useAuth();
  const [showDailyReward, setShowDailyReward] = useState(false);

  const checkedRef = useRef<string | null>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (authLoading)  return;
    if (!user?.uid)   return;
    if (checkedRef.current === user.uid) return;

    checkEngagements(user.uid);
  }, [user?.uid, authLoading]);

  async function checkEngagements(uid: string) {
    try {
      // Lazy: resolvido aqui, não no import do módulo.
      const fn = httpsCallable<void, { alreadyClaimed: boolean }>(
        getFunctions(),
        'getDailyRewardStatus',
      );

      const result = await fn();

      // Só marca como verificado APÓS sucesso — uma falha
      // transitória deve permitir nova tentativa.
      checkedRef.current = uid;

      if (__DEV__) {
        console.log('[EngagementInitializer] alreadyClaimed:', result.data.alreadyClaimed);
      }

      if (!result.data.alreadyClaimed && mountedRef.current) {
        timerRef.current = setTimeout(() => {
          if (mountedRef.current) setShowDailyReward(true);
        }, REVEAL_DELAY_MS);
      }

      // Gatilhos emocionais pendentes são tratados na
      // NotificationsScreen — não abrimos modal aqui para não
      // sobrecarregar o usuário ao abrir o app. O badge do sino
      // já indica notificações não lidas.
    } catch (error) {
      // FAIL-CLOSED: não sabemos se já resgatou, então não
      // oferecemos. Mostrar o modal aqui exibiria uma recompensa
      // que a CF vai rejeitar — e, se claimDailyReward não tiver
      // guard de idempotência, seria vetor de farm.
      if (__DEV__) {
        console.error('[EngagementInitializer] getDailyRewardStatus falhou:', error);
      }
    }
  }

  if (!showDailyReward || !user?.uid) return null;

  return (
    <DailyRewardModal
      uid={user.uid}
      visible={showDailyReward}
      onClose={() => setShowDailyReward(false)}
    />
  );
}
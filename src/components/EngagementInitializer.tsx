// ============================================
// LUMINA — ENGAGEMENT INITIALIZER v5.5
// src/components/EngagementInitializer.tsx
//
// v5.4: Verifica recompensa diária + gatilhos pendentes
// Modal de recompensa diária aparece primeiro.
// Se houver gatilhos não lidos → badge no sino.
//
// v5.5 (13/10/2026):
// - Falha do servidor NÃO abre mais o modal "por garantia" (podia
//   oferecer recompensa já coletada). Tenta de novo uma vez após 5 s;
//   se falhar de novo, não abre — volta a verificar na próxima
//   abertura do app.
// - Temporizadores cancelados ao desmontar ou trocar de conta.
// - Sem log com uid.
// - getFunctions() na hora da chamada, não no topo do arquivo
//   (evita depender da ordem de inicialização do Firebase).
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth }       from '../context/AuthContext';
import DailyRewardModal  from './DailyRewardModal';

const SHOW_DELAY_MS  = 1500;
const RETRY_DELAY_MS = 5000;
const MAX_ATTEMPTS   = 2;

type Timer = ReturnType<typeof setTimeout>;

function errorCode(error: unknown): string {
  return (error as { code?: string } | null)?.code ?? 'unknown';
}

export default function EngagementInitializer() {
  const { user, loading: authLoading } = useAuth();
  const [showDailyReward, setShowDailyReward] = useState(false);
  const checkedRef   = useRef<string | null>(null);
  const activeUidRef = useRef<string | null>(null);
  const mountedRef   = useRef(true);
  const timersRef    = useRef<Timer[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const uid = user?.uid ?? null;

    if (activeUidRef.current !== uid) {
      // Saiu ou trocou de conta: nada da conta anterior continua.
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setShowDailyReward(false);
    }
    activeUidRef.current = uid;

    if (!uid) return;
    if (checkedRef.current === uid) return;
    checkedRef.current = uid;

    void checkDailyReward(uid, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, authLoading]);

  function isCurrent(uid: string): boolean {
    return mountedRef.current && activeUidRef.current === uid;
  }

  function schedule(fn: () => void, ms: number): void {
    timersRef.current.push(setTimeout(fn, ms));
  }

  async function checkDailyReward(uid: string, attempt: number): Promise<void> {
    try {
      const fn = httpsCallable<void, { alreadyClaimed: boolean }>(
        getFunctions(), 'getDailyRewardStatus'
      );
      const { data } = await fn();
      if (!isCurrent(uid)) return;

      if (!data.alreadyClaimed) {
        schedule(() => { if (isCurrent(uid)) setShowDailyReward(true); }, SHOW_DELAY_MS);
      }

      // Gatilhos emocionais pendentes são tratados
      // na NotificationsScreen — não abrimos modal aqui
      // para não sobrecarregar o usuário ao abrir o app.
      // O badge do sino já indica notificações não lidas.
    } catch (error) {
      if (!isCurrent(uid)) return;
      if (attempt < MAX_ATTEMPTS) {
        schedule(() => { if (isCurrent(uid)) void checkDailyReward(uid, attempt + 1); }, RETRY_DELAY_MS);
        return;
      }
      console.warn(
        '[EngagementInitializer] Status da recompensa diária indisponível; modal não exibido.',
        errorCode(error),
      );
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
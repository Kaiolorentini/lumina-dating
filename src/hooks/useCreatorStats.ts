// ============================================
// useCreatorStats — HOOK
// src/hooks/useCreatorStats.ts
//
// Resumo do criador para o rodapé do Painel. Só escuta com
// enabled=true (conta que vende): quem só compra não gasta leitura.
// Virada do mês com o painel aberto: o resumo é recalculado na
// próxima atualização do documento ou ao reabrir a tela.
// ============================================

import { useEffect, useState } from 'react';
import {
  CreatorStats, EMPTY_CREATOR_STATS, listenToCreatorStats,
} from '../services/marketplace/creatorStatsService';

interface UseCreatorStatsReturn {
  stats: CreatorStats;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useCreatorStats(uid: string | undefined, enabled: boolean): UseCreatorStatsReturn {
  const [stats, setStats]     = useState<CreatorStats>(EMPTY_CREATOR_STATS);
  const [loading, setLoading] = useState(enabled);
  const [error, setError]     = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid || !enabled) {
      setStats(EMPTY_CREATOR_STATS);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const unsubscribe = listenToCreatorStats(
      uid,
      data => {
        if (!active) return;
        setStats(data);
        setLoading(false);
      },
      err => {
        if (!active) return;
        console.warn('[useCreatorStats] falhou:', err);
        setError('Não foi possível carregar seus números.');
        setLoading(false);
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [uid, enabled, attempt]);

  return { stats, loading, error, retry: () => setAttempt(n => n + 1) };
}

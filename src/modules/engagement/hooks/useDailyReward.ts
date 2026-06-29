// ============================================
// LUMINA — USE DAILY REWARD HOOK v5.1
// src/modules/engagement/hooks/useDailyReward.ts
//
// Gerencia estado da recompensa diária.
// Nunca credita client-side — apenas chama CF.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';

const functions = getFunctions();

export interface DailyRewardStatus {
  alreadyClaimed: boolean;
  currentStreak:  number;
  longestStreak:  number;
  totalClaimed:   number;
  nextReward:     number;
  todayReward:    number;
  streakRewards:  Record<number, number>;
}

export interface DailyRewardResult {
  crystals:      number;
  currentStreak: number;
  longestStreak: number;
  nextReward:    number;
}

interface State {
  status:   DailyRewardStatus | null;
  loading:  boolean;
  claiming: boolean;
  error:    string | null;
}

export function useDailyReward(uid: string | undefined) {
  const [state, setState] = useState<State>({
    status:   null,
    loading:  true,
    claiming: false,
    error:    null,
  });

  // Carrega estado atual
  const loadStatus = useCallback(async () => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const fn     = httpsCallable<void, DailyRewardStatus>(functions, 'getDailyRewardStatus');
      const result = await fn();
      setState(prev => ({ ...prev, status: result.data, loading: false }));
    } catch (error) {
      console.error('[useDailyReward] loadStatus error:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar recompensa.' }));
    }
  }, [uid]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Resgata recompensa
  const claimReward = useCallback(async (): Promise<DailyRewardResult | null> => {
    if (!uid || state.status?.alreadyClaimed) return null;

    setState(prev => ({ ...prev, claiming: true, error: null }));
    try {
      const fn     = httpsCallable<void, { success: boolean } & DailyRewardResult>(
        functions, 'claimDailyReward'
      );
      const result = await fn();

      // Atualiza status local após claim
      setState(prev => ({
        ...prev,
        claiming: false,
        status: prev.status ? {
          ...prev.status,
          alreadyClaimed: true,
          currentStreak:  result.data.currentStreak,
          longestStreak:  result.data.longestStreak,
          nextReward:     result.data.nextReward,
        } : prev.status,
      }));

      return result.data;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao resgatar recompensa.';
      setState(prev => ({ ...prev, claiming: false, error: msg }));
      return null;
    }
  }, [uid, state.status?.alreadyClaimed]);

  return {
    status:      state.status,
    loading:     state.loading,
    claiming:    state.claiming,
    error:       state.error,
    claimReward,
    refresh:     loadStatus,
  };
}
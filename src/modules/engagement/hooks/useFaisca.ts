// ============================================
// LUMINA — USE FAISCA HOOK v5.1
// src/modules/engagement/hooks/useFaisca.ts
//
// Gerencia estado da Faísca do Destino.
// Nunca credita client-side — apenas chama CF.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';

const functions = getFunctions();

export type FaiscaTier = 'common' | 'rare' | 'epic' | 'legendary';

export interface FaiscaStatus {
  alreadyClaimed: boolean;
  totalClaimed:   number;
  claimsCount:    number;
  lastValue:      number | null;
  lastTier:       FaiscaTier | null;
}

export interface FaiscaResult {
  crystals: number;
  tier:     FaiscaTier;
}

interface State {
  status:   FaiscaStatus | null;
  loading:  boolean;
  claiming: boolean;
  error:    string | null;
}

export function useFaisca(uid: string | undefined) {
  const [state, setState] = useState<State>({
    status:   null,
    loading:  true,
    claiming: false,
    error:    null,
  });

  const loadStatus = useCallback(async () => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const fn     = httpsCallable<void, FaiscaStatus>(functions, 'getDailyFaiscaStatus');
      const result = await fn();
      setState(prev => ({ ...prev, status: result.data, loading: false }));
    } catch (error) {
      console.error('[useFaisca] loadStatus error:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar Faísca.' }));
    }
  }, [uid]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const claimFaisca = useCallback(async (): Promise<FaiscaResult | null> => {
    if (!uid || state.status?.alreadyClaimed) return null;

    setState(prev => ({ ...prev, claiming: true, error: null }));
    try {
      const fn     = httpsCallable<void, { success: boolean } & FaiscaResult>(
        functions, 'claimDailyFaisca'
      );
      const result = await fn();

      setState(prev => ({
        ...prev,
        claiming: false,
        status: prev.status ? {
          ...prev.status,
          alreadyClaimed: true,
          lastValue:      result.data.crystals,
          lastTier:       result.data.tier,
        } : prev.status,
      }));

      return { crystals: result.data.crystals, tier: result.data.tier };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao resgatar Faísca.';
      setState(prev => ({ ...prev, claiming: false, error: msg }));
      return null;
    }
  }, [uid, state.status?.alreadyClaimed]);

  return {
    status:      state.status,
    loading:     state.loading,
    claiming:    state.claiming,
    error:       state.error,
    claimFaisca,
    refresh:     loadStatus,
  };
}
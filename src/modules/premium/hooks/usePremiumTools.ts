// ============================================
// LUMINA — USE PREMIUM TOOLS HOOK v5.1
// src/modules/premium/hooks/usePremiumTools.ts
//
// Hook unificado para todas as ferramentas Premium.
// Estado calculado server-side — cliente só exibe.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';
import { PremiumFeatureStatus }              from '../../../navigation/types';

const functions = getFunctions();

export interface FertilizerStatus {
  status:         PremiumFeatureStatus;
  isActive:       boolean;
  expiresAt:      string | null;
  remainingMs:    number;
  remainingHours: number;
  xpMultiplier:   number;
  cost:           number;
  coinsPremium:   number;
  enabled:        boolean;
}

export interface TurboStatus {
  status:       PremiumFeatureStatus;
  isActive:     boolean;
  expiresAt:    string | null;
  remainingMs:  number;
  remainingMin: number;
  boostScore:   number;
  cooldownMs:   number;
  inCooldown:   boolean;
  cost:         number;
  coinsPremium: number;
  enabled:      boolean;
}

interface State {
  fertilizer: FertilizerStatus | null;
  turbo:      TurboStatus | null;
  loading:    boolean;
  activating: string | null;
  error:      string | null;
}

export function usePremiumTools(uid: string | undefined) {
  const [state, setState] = useState<State>({
    fertilizer: null,
    turbo:      null,
    loading:    true,
    activating: null,
    error:      null,
  });

  const load = useCallback(async () => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const [fertFn, turboFn] = [
        httpsCallable<void, FertilizerStatus>(functions, 'getFertilizerStatus'),
        httpsCallable<void, TurboStatus>(functions, 'getTurboStatus'),
      ];
      const [fertResult, turboResult] = await Promise.all([fertFn(), turboFn()]);
      setState(prev => ({
        ...prev,
        fertilizer: fertResult.data,
        turbo:      turboResult.data,
        loading:    false,
      }));
    } catch (error) {
      console.error('[usePremiumTools] load error:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar ferramentas.' }));
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const activateFertilizer = useCallback(async (): Promise<boolean> => {
    if (!uid || state.activating) return false;
    setState(prev => ({ ...prev, activating: 'FERTILIZER', error: null }));
    try {
      const fn = httpsCallable<void, { success: boolean; remainingMs: number; xpMultiplier: number }>(
        functions, 'activateFertilizer'
      );
      const result = await fn();
      if (result.data.success) {
        await load();
        return true;
      }
      return false;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao ativar Fertilizante.';
      setState(prev => ({ ...prev, error: msg }));

      // REGRA 11: registra tentativa para Offer Engine
      try {
        const attempt = httpsCallable(functions, 'registerPremiumAttempt');
        await attempt({ feature: 'FERTILIZER' });
      } catch { /* silencioso */ }

      return false;
    } finally {
      setState(prev => ({ ...prev, activating: null }));
    }
  }, [uid, state.activating, load]);

  const activateTurbo = useCallback(async (): Promise<boolean> => {
    if (!uid || state.activating) return false;
    setState(prev => ({ ...prev, activating: 'TURBO', error: null }));
    try {
      const fn = httpsCallable<void, { success: boolean }>(functions, 'activateTurbo');
      const result = await fn();
      if (result.data.success) {
        await load();
        return true;
      }
      return false;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao ativar Turbo.';
      setState(prev => ({ ...prev, error: msg }));

      // REGRA 11: registra tentativa para Offer Engine
      try {
        const attempt = httpsCallable(functions, 'registerPremiumAttempt');
        await attempt({ feature: 'TURBO' });
      } catch { /* silencioso */ }

      return false;
    } finally {
      setState(prev => ({ ...prev, activating: null }));
    }
  }, [uid, state.activating, load]);

  return {
    fertilizer:        state.fertilizer,
    turbo:             state.turbo,
    loading:           state.loading,
    activating:        state.activating,
    error:             state.error,
    activateFertilizer,
    activateTurbo,
    refresh:           load,
  };
}
// ============================================
// LUMINA — USE FRAGMENTS HOOK v5.2
// src/modules/engagement/hooks/useFragments.ts
//
// Usa getFragmentsStatus (novo) +
// convertFragments (existente em economy/)
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';

const functions = getFunctions();

export interface FragmentsStatus {
  fragments:           number;
  coinsGratuitos:      number;
  coinsPremium:        number;
  canConvert:          boolean;
  crystalsAvailable:   number;
  fragmentsNeeded:     number;
  cooldownActive:      boolean;
  cooldownRemainingMs: number;
  lastConversionAt:    string | null;
}

export interface ConversionResult {
  crystalsGained:      number;
  fragmentsUsed:       number;
  fragmentsRemaining:  number;
  newBalanceGratuitos: number;
}

interface State {
  status:     FragmentsStatus | null;
  loading:    boolean;
  converting: boolean;
  error:      string | null;
}

export function useFragments(uid: string | undefined) {
  const [state, setState] = useState<State>({
    status:     null,
    loading:    true,
    converting: false,
    error:      null,
  });

  const loadStatus = useCallback(async () => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const fn     = httpsCallable<void, FragmentsStatus>(functions, 'getFragmentsStatus');
      const result = await fn();
      setState(prev => ({ ...prev, status: result.data, loading: false }));
    } catch (error) {
      console.error('[useFragments] load error:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar fragmentos.' }));
    }
  }, [uid]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const convert = useCallback(async (): Promise<ConversionResult | null> => {
    if (!uid || state.converting || !state.status?.canConvert) return null;
    setState(prev => ({ ...prev, converting: true, error: null }));
    try {
      // Usa convertFragments existente do economy/
      const fn     = httpsCallable<void, ConversionResult>(functions, 'convertFragments');
      const result = await fn();

      setState(prev => ({
        ...prev,
        converting: false,
        status: prev.status ? {
          ...prev.status,
          fragments:           result.data.fragmentsRemaining,
          coinsGratuitos:      result.data.newBalanceGratuitos,
          canConvert:          result.data.fragmentsRemaining >= (prev.status?.fragmentsNeeded ?? 100),
          cooldownActive:      true,
          cooldownRemainingMs: 24 * 60 * 60 * 1000,
          crystalsAvailable:   Math.floor(result.data.fragmentsRemaining / (prev.status?.fragmentsNeeded ?? 100)),
        } : null,
      }));

      return result.data;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao converter fragmentos.';
      setState(prev => ({ ...prev, converting: false, error: msg }));
      return null;
    }
  }, [uid, state.converting, state.status]);

  return {
    status:     state.status,
    loading:    state.loading,
    converting: state.converting,
    error:      state.error,
    convert,
    refresh:    loadStatus,
  };
}
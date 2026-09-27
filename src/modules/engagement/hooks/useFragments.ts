// ============================================
// LUMINA — USE FRAGMENTS HOOK v6.0
// src/modules/engagement/hooks/useFragments.ts
//
// v6.0 — convert(cristais): a pessoa escolhe quanto converte.
// Sem teto, sem espera, sem expiração.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';

const functions = getFunctions();

export interface FragmentsStatus {
  fragments:            number;
  coinsGratuitos:       number;
  coinsPremium:         number;
  canConvert:           boolean;
  crystalsAvailable:    number;
  fragmentsPerCrystal?: number;
  fragmentsNeeded:      number;
  lastConversionAt:     string | null;
}

export interface ConversionResult {
  crystalsGained:      number;
  fragmentsUsed:       number;
  fragmentsRemaining:  number;
  newBalanceGratuitos: number;
}

interface ConvertPayload {
  crystals: number;
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

  /** silent: recarrega sem voltar para a tela de loading. */
  const loadStatus = useCallback(async (silent = false) => {
    if (!uid) return;
    if (!silent) setState(prev => ({ ...prev, loading: true, error: null }));
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

  const convert = useCallback(async (crystals: number): Promise<ConversionResult | null> => {
    if (!uid || state.converting || crystals < 1) return null;
    setState(prev => ({ ...prev, converting: true, error: null }));
    try {
      const fn     = httpsCallable<ConvertPayload, ConversionResult>(functions, 'convertFragments');
      const result = await fn({ crystals });
      const perCrystal = state.status?.fragmentsPerCrystal ?? state.status?.fragmentsNeeded ?? 100;

      setState(prev => ({
        ...prev,
        converting: false,
        status: prev.status ? {
          ...prev.status,
          fragments:         result.data.fragmentsRemaining,
          coinsGratuitos:    result.data.newBalanceGratuitos,
          canConvert:        result.data.fragmentsRemaining >= perCrystal,
          crystalsAvailable: Math.floor(result.data.fragmentsRemaining / perCrystal),
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
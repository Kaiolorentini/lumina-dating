// ============================================
// LUMINA — USE VAULT HOOK v5.2
// src/modules/engagement/hooks/useVault.ts
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';

const functions = getFunctions();

export type VaultStatus = 'EMPTY' | 'FILLING' | 'READY' | 'FULL';

export interface VaultData {
  vaultFragments:      number;
  vaultMax:            number;
  vaultPercent:        number;
  crystalsEquivalent:  number;
  status:              VaultStatus;
  canWithdraw:         boolean;
  isGalaxiaPlus:       boolean;
  isLocked:            boolean;
  cooldownRemainingMs: number;
  antiSpamActive:      boolean;
  crystalsToday:       number;
  dailyLimit:          number;
  unlockAt:            string | null;
  lastWithdrawAt:      string | null;
}

export interface WithdrawResult {
  crystalsGained:      number;
  fragmentsUsed:       number;
  vaultRemaining:      number;
  vaultStatus:         VaultStatus;
  newBalanceGratuitos: number;
  isGalaxiaPlus:       boolean;
}

interface State {
  data:        VaultData | null;
  loading:     boolean;
  withdrawing: boolean;
  error:       string | null;
}

export function useVault(uid: string | undefined) {
  const [state, setState] = useState<State>({
    data:        null,
    loading:     true,
    withdrawing: false,
    error:       null,
  });

  const loadStatus = useCallback(async () => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const fn     = httpsCallable<void, VaultData>(functions, 'getVaultStatus');
      const result = await fn();
      setState(prev => ({ ...prev, data: result.data, loading: false }));
    } catch (error) {
      console.error('[useVault] load error:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar Cofre.' }));
    }
  }, [uid]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const withdraw = useCallback(async (): Promise<WithdrawResult | null> => {
    if (!uid || state.withdrawing || !state.data?.canWithdraw) return null;
    setState(prev => ({ ...prev, withdrawing: true, error: null }));
    try {
      const fn     = httpsCallable<void, { success: boolean } & WithdrawResult>(
        functions, 'withdrawFromVault'
      );
      const result = await fn();

      // Atualiza estado local com resultado do servidor
      setState(prev => ({
        ...prev,
        withdrawing: false,
        data: prev.data ? {
          ...prev.data,
          vaultFragments:      result.data.vaultRemaining,
          vaultPercent:        (result.data.vaultRemaining / (prev.data?.vaultMax ?? 5000)) * 100,
          crystalsEquivalent:  Math.floor(result.data.vaultRemaining / 100),
          status:              result.data.vaultStatus,
          canWithdraw:         false,
          isLocked:            !result.data.isGalaxiaPlus,
          cooldownRemainingMs: !result.data.isGalaxiaPlus ? 48 * 60 * 60 * 1000 : 0,
          crystalsToday:       (prev.data?.crystalsToday ?? 0) + result.data.crystalsGained,
        } : null,
      }));

      return result.data;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao sacar do Cofre.';
      setState(prev => ({ ...prev, withdrawing: false, error: msg }));
      return null;
    }
  }, [uid, state.withdrawing, state.data?.canWithdraw]);

  return {
    data:        state.data,
    loading:     state.loading,
    withdrawing: state.withdrawing,
    error:       state.error,
    withdraw,
    refresh:     loadStatus,
  };
}
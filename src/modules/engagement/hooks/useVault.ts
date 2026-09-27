// ============================================
// LUMINA — USE VAULT HOOK v6.0
// src/modules/engagement/hooks/useVault.ts
//
// v6.0 — o saque move fragmentos do Cofre para a carteira. Depois
// dele, o estado vem do SERVIDOR (recarga silenciosa): a versão
// anterior inventava 48h de bloqueio local, e o servidor zera o
// ciclo no saque — tela e servidor discordavam.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';

const functions = getFunctions();

export type VaultStatus = 'EMPTY' | 'FILLING' | 'READY' | 'FULL';

export interface VaultData {
  vaultFragments:      number;
  walletFragments:     number;
  vaultMax:            number;
  vaultPercent:        number;
  crystalsEquivalent:  number;
  status:              VaultStatus;
  canWithdraw:         boolean;
  isGalaxiaPlus:       boolean;
  isLocked:            boolean;
  cooldownRemainingMs: number;
  antiSpamActive:      boolean;
  unlockAt:            string | null;
  lastWithdrawAt:      string | null;
}

export interface WithdrawResult {
  fragmentsMoved:  number;
  walletFragments: number;
  usedPlusBypass:  boolean;
}

interface WithdrawResponse extends WithdrawResult {
  success: boolean;
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

  /** silent: recarrega sem voltar para a tela de loading. */
  const loadStatus = useCallback(async (silent = false) => {
    if (!uid) return;
    if (!silent) setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const fn     = httpsCallable<void, VaultData>(functions, 'getVaultStatus');
      const result = await fn();
      setState(prev => ({ ...prev, data: result.data, loading: false }));
    } catch (error) {
      console.error('[useVault] load error:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar o Cofre.' }));
    }
  }, [uid]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const withdraw = useCallback(async (): Promise<WithdrawResult | null> => {
    if (!uid || state.withdrawing || !state.data?.canWithdraw) return null;
    setState(prev => ({ ...prev, withdrawing: true, error: null }));
    try {
      const fn     = httpsCallable<void, WithdrawResponse>(functions, 'withdrawFromVault');
      const result = await fn();
      setState(prev => ({ ...prev, withdrawing: false }));
      await loadStatus(true);
      return result.data;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao sacar do Cofre.';
      setState(prev => ({ ...prev, withdrawing: false, error: msg }));
      return null;
    }
  }, [uid, state.withdrawing, state.data?.canWithdraw, loadStatus]);

  return {
    data:        state.data,
    loading:     state.loading,
    withdrawing: state.withdrawing,
    error:       state.error,
    withdraw,
    refresh:     loadStatus,
  };
}
// ============================================
// LUMINA — USE WALLET HOOK
// src/modules/economy/hooks/useWallet.ts
//
// v5.0 — FASE 0: Blindagem da Economia
//
// REGRA 1: earn/spend chamam Cloud Functions.
// Nenhum crédito/débito acontece aqui.
// Saldo atualizado via onSnapshot (real-time).
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  subscribeToWallet,
  spendCoins as cfSpendCoins,
  initWallet,
  totalBalance,
  SpendableFeature,
} from '../services/walletService';
import { Wallet } from '../../../shared/types';

interface UseWalletReturn {
  wallet: Wallet | null;
  loading: boolean;
  totalCoins: number;
  refresh: () => void;
  spend: (feature: SpendableFeature, idempotencyKey?: string) => Promise<boolean>;
}

export function useWallet(): UseWalletReturn {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setWallet(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Inicializa carteira se não existir (idempotente no backend)
    initWallet().catch(console.error);

    // Listener em tempo real — saldo sempre atualizado
    const unsubscribe = subscribeToWallet(
      user.uid,
      (updatedWallet) => {
        setWallet(updatedWallet);
        setLoading(false);
      },
      (error) => {
        console.error('[useWallet] Erro no listener:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // REGRA 1: spend chama Cloud Function, não modifica Firestore diretamente
  const spend = useCallback(async (
    feature: SpendableFeature,
    idempotencyKey?: string
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      const result = await cfSpendCoins(feature, idempotencyKey);
      // Saldo atualiza automaticamente via onSnapshot
      return result.success;
    } catch (error: any) {
      if (error?.code === 'already-exists') {
        console.warn('[useWallet] Operação já processada (idempotente).');
        return false;
      }
      if (error?.code === 'failed-precondition') {
        console.warn('[useWallet] Saldo insuficiente.');
        return false;
      }
      console.error('[useWallet] spend error:', error);
      return false;
    }
  }, [user]);

  // refresh manual — onSnapshot já é real-time, mas exposto para pull-to-refresh
  const refresh = useCallback(() => {
    // o listener onSnapshot já mantém atualizado
    // este método existe apenas por compatibilidade de interface
  }, []);

  return {
    wallet,
    loading,
    totalCoins: wallet ? totalBalance(wallet) : 0,
    refresh,
    spend,
  };
}
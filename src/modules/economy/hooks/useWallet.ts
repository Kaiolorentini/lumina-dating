import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getWallet, addCoins, spendCoins } from '../services/walletService';
import { Wallet } from '../../../shared/types';

// ============================================
// useWallet
//
// Hook reutilizável para qualquer tela
// que precise do saldo de moedas.
// ============================================

interface UseWalletReturn {
  wallet: Wallet | null;
  loading: boolean;
  refresh: () => Promise<void>;
  earn: (amount: number, description: string) => Promise<void>;
  spend: (amount: number, description: string) => Promise<boolean>;
}

export function useWallet(): UseWalletReturn {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadWallet();
    } else {
      setWallet(null);
      setLoading(false);
    }
  }, [user]);

  const loadWallet = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getWallet(user.uid);
      setWallet(data);
    } catch (error) {
      console.error('useWallet error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  async function earn(amount: number, description: string) {
    if (!user) return;
    await addCoins(user.uid, amount, description);
    await loadWallet();
  }

  async function spend(amount: number, description: string): Promise<boolean> {
    if (!user) return false;
    const success = await spendCoins(user.uid, amount, description);
    if (success) await loadWallet();
    return success;
  }

  return {
    wallet,
    loading,
    refresh: loadWallet,
    earn,
    spend,
  };
}
import React, { createContext, useContext } from 'react';
import { useWallet } from '../modules/economy/hooks/useWallet';
import { Wallet } from '../shared/types';

// ============================================
// COINS CONTEXT — agora usa useWallet
// Mantido para compatibilidade com imports antigos
// ============================================

interface CoinsContextData {
  wallet: Wallet | null;
  loading: boolean;
  refreshWallet: () => Promise<void>;
  spend: (amount: number, description: string) => Promise<boolean>;
  earn: (amount: number, description: string) => Promise<void>;
}

const CoinsContext = createContext<CoinsContextData>({} as CoinsContextData);

export function CoinsProvider({ children }: { children: React.ReactNode }) {
  const { wallet, loading, refresh, earn, spend } = useWallet();

  return (
    <CoinsContext.Provider value={{
      wallet,
      loading,
      refreshWallet: refresh,
      spend,
      earn,
    }}>
      {children}
    </CoinsContext.Provider>
  );
}

export function useCoins() {
  return useContext(CoinsContext);
}
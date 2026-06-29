// ============================================
// LUMINA — COINS CONTEXT
// src/context/CoinsContext.tsx
//
// v5.0 — Mantido para compatibilidade com imports antigos.
// Wrapper sobre useWallet.
// earn() foi removido — créditos são exclusivos do backend.
// spend() agora recebe feature (não valor) — REGRA 3B.
// ============================================

import React, { createContext, useContext } from 'react';
import { useWallet } from '../modules/economy/hooks/useWallet';
import { Wallet } from '../shared/types';
import { SpendableFeature } from '../modules/economy/services/walletService';

interface CoinsContextData {
  wallet: Wallet | null;
  loading: boolean;
  totalCoins: number;
  refreshWallet: () => void;
  // REGRA 3B: recebe feature, não valor monetário
  spend: (feature: SpendableFeature, idempotencyKey?: string) => Promise<boolean>;
}

const CoinsContext = createContext<CoinsContextData>({} as CoinsContextData);

export function CoinsProvider({ children }: { children: React.ReactNode }) {
  const { wallet, loading, totalCoins, refresh, spend } = useWallet();

  return (
    <CoinsContext.Provider value={{
      wallet,
      loading,
      totalCoins,
      refreshWallet: refresh,
      spend,
    }}>
      {children}
    </CoinsContext.Provider>
  );
}

export function useCoins() {
  return useContext(CoinsContext);
}

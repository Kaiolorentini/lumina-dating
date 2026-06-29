// ============================================
// LUMINA — COINS SERVICE v5.1
// src/services/coinsService.ts
//
// Compatibilidade — re-exporta do módulo novo.
// getWallet e addCoins REMOVIDOS (proibidos).
// purchaseCoins SUBSTITUÍDO por initiatePurchase.
// ============================================

export {
  subscribeToWallet,
  spendCoins,
  convertFragments,
  initWallet,
  formatCrystals,
  totalBalance,
  isPremiumOnly,
} from '../modules/economy/services/walletService';

export type { SpendableFeature } from '../modules/economy/services/walletService';

export {
  COIN_PACKAGES_DISPLAY,
  initiatePurchase,
} from '../modules/economy/services/purchaseService';

export type { CoinPackageDisplay } from '../modules/economy/services/purchaseService';

export {
  getTransactions,
} from '../modules/economy/services/transactionService';

export type { Transaction } from '../shared/types';
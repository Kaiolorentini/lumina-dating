// ============================================
// LUMINA — ECONOMY MODULE INDEX
// src/modules/economy/index.ts
//
// v5.1 — Blindagem da Economia
//
// REMOVIDO:
//   - getWallet (leitura direta — usar subscribeToWallet)
//   - addCoins (crédito client-side — proibido)
//   - purchaseCoins (compra client-side — proibido)
//   - COIN_PACKAGES client (preços ficam no backend)
//
// MANTIDO:
//   - StoreScreen (tela — sem lógica financeira)
//   - useWallet (hook de leitura + spend via CF)
//   - spendCoins (chama Cloud Function)
//   - getTransactions (leitura de histórico — ok)
//
// ADICIONADO:
//   - subscribeToWallet (listener real-time)
//   - convertFragments (conversão via CF)
//   - formatCrystals, totalBalance, isPremiumOnly (helpers)
// ============================================

export { default as StoreScreen } from './screens/StoreScreen';

export { useWallet } from './hooks/useWallet';

export {
  subscribeToWallet,
  spendCoins,
  convertFragments,
  initWallet,
  formatCrystals,
  totalBalance,
  isPremiumOnly,
} from './services/walletService';

export type { SpendableFeature } from './services/walletService';

export { getTransactions } from './services/transactionService';
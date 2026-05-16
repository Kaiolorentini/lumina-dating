// Compatibilidade — re-exporta do módulo novo
export {
  getWallet,
  addCoins,
  spendCoins,
} from '../modules/economy/services/walletService';

export {
  purchaseCoins,
  COIN_PACKAGES,
} from '../modules/economy/services/purchaseService';

export {
  getTransactions,
} from '../modules/economy/services/transactionService';
// ============================================
// WALLET TYPES — MARKETPLACE
//
// CreatorWallet e CreatorTransaction são DIFERENTES de:
// Wallet (src/shared/types/index.ts) — sistema de moedas
// Transaction (src/shared/types/index.ts) — sistema de moedas
// ============================================

export type CreatorTransactionType =
  | 'sale'
  | 'withdrawal'
  | 'refund'
  | 'commission'
  | 'chargeback';

export type PixType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'chave';

export interface CreatorWallet {
  userId: string;
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  hasChargebackPending: boolean;
  pixKey?: string;
  pixType?: PixType;
  updatedAt: Date;
}

export interface CreatorTransaction {
  id: string;
  userId: string;
  type: CreatorTransactionType;
  amount: number;
  description: string;
  saleId?: string;
  createdAt: Date;
}
// ============================================
// WITHDRAWAL TYPES — MARKETPLACE
// ============================================

export type WithdrawalStatus =
  | 'pending'
  | 'approved'
  | 'paid'
  | 'rejected';

export interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  balanceAtRequest: number;
  pixKey?: string;
  pixType?: string;
  status: WithdrawalStatus;
  rejectionReason?: string;
  createdAt: Date;
  processedAt?: Date;
  processedBy?: string;
}
// ============================================
// NOTIFICATION TYPES — MARKETPLACE
//
// Extensão do NotificationType existente.
// NÃO modificar shared/types/index.ts.
// ============================================

export type MarketplaceNotificationType =
  | 'creator_approved'
  | 'creator_rejected'
  | 'product_approved'
  | 'product_rejected'
  | 'product_favorited'
  | 'sale_completed'
  | 'purchase_confirmed'
  | 'withdrawal_approved'
  | 'withdrawal_paid'
  | 'withdrawal_rejected'
  | 'refund_processed'
  | 'chargeback_detected'
  | 'new_review';

export interface MarketplaceNotification {
  id: string;
  userId: string;
  type: MarketplaceNotificationType;
  message: string;
  read: boolean;
  data?: Record<string, unknown>;
  timestamp: Date;
}
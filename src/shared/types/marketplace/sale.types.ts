// ============================================
// SALE TYPES — MARKETPLACE
// ============================================

export type SaleStatus =
  | 'pending'
  | 'paid'
  | 'refund_requested'    // ← ADICIONAR
  | 'partially_refunded'
  | 'refunded';
export type PaymentStatus =
  | 'pending'
  | 'received'
  | 'overdue'
  | 'refunded'
  | 'cancelled';

export type PaymentMethod = 'pix' | 'credit_card' | 'free';

export interface Sale {
  id: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  purchaseId: string;
  amount: number;
  platformCommission: number;
  sellerAmount: number;
  couponCode?: string;
  discountAmount?: number;
  originalAmount?: number;
  status: SaleStatus;
  paymentStatus: PaymentStatus;
  paymentProvider: 'asaas';
  paymentId: string;
  paymentMethod: PaymentMethod;
  checkoutUrl?: string;
  isChargebacked: boolean;
  chargebackedAt?: Date;
  webhookProcessedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  paidAt?: Date;
  refundedAt?: Date;
  refundRequestedAt?: Date        // ← ADICIONAR
  refundWindowExpiresAt?: Date    // ← ADICIONAR (paidAt + 24h)
  couponId?: string;
  couponType?: 'percentage' | 'fixed';
  couponValue?: number;
  finalAmount?: number;
}
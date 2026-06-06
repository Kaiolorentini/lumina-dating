// ============================================
// PURCHASE TYPES — MARKETPLACE
//
// purchaseId = buyerId + '_' + productId
// ============================================

export type PurchaseStatus = 'active' | 'refunded' | 'revoked';

export interface Purchase {
  buyerId: string;
  sellerId: string;
  productId: string;
  saleId?: string;
  amount: number;
  status: PurchaseStatus;
  isRevoked: boolean;
  downloadedAt?: Date;
  createdAt: Date;
  refundedAt?: Date    // ← ADICIONAR
}
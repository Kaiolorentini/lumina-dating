// ============================================
// COUPON TYPES — MARKETPLACE
// ============================================

export type CouponDiscountType = 'percentage' | 'fixed';

export interface Coupon {
  id?: string;                      // id do documento Firestore (autoId)
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  startDate: Date;                  // início da validade
  expiresAt: Date;                  // fim da validade
  maxUses: number;                  // 0 = ilimitado
  usedCount: number;
  minimumPurchaseAmount?: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  productIds?: string[];            // undefined = global
  creatorId?: string;              // undefined = global
}

export interface CouponUse {
  userId: string;
  code: string;
  usedAt: Date;
}
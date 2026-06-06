// ============================================
// COUPON TYPES — MARKETPLACE
// ============================================

export type CouponDiscountType = 'percentage' | 'fixed';

export interface Coupon {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
  createdBy: string;
  isActive: boolean;
  productIds?: string[];
  creatorId?: string;
}

export interface CouponUse {
  userId: string;
  code: string;
  usedAt: Date;
}
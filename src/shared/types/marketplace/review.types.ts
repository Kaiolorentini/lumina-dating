// ============================================
// REVIEW TYPES — MARKETPLACE
//
// reviewId = userId + '_' + productId
// ============================================

export interface ProductReview {
  productId: string;
  userId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  isHidden: boolean;
  hiddenReason?: string;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}
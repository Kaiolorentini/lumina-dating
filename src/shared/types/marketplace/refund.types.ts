export type RefundRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface RefundRequest {
  id: string;
  saleId: string;
  purchaseId: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  amount: number;
  sellerAmount: number;
  reason: string;
  status: RefundRequestStatus;
  createdAt: Date;
  expiresAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
}
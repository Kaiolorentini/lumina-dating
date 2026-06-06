// ============================================
// FRAUD TYPES — MARKETPLACE
// ============================================

export type FraudReason =
  | 'chargeback'
  | 'spam'
  | 'multiaccount'
  | 'abuse'
  | 'piracy'
  | 'suspicious_activity';

export type FraudStatus =
  | 'open'
  | 'reviewing'
  | 'resolved'
  | 'dismissed';

export interface FraudFlag {
  id: string;
  userId: string;
  reason: FraudReason;
  status: FraudStatus;
  description: string;
  relatedSaleId?: string;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}
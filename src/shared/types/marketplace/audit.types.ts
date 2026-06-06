// ============================================
// AUDIT TYPES — MARKETPLACE
//
// ip é preenchido APENAS por Cloud Functions.
// O app React Native NUNCA preenche ip.
// ============================================

export type AuditTargetType =
  | 'creator'
  | 'product'
  | 'withdrawal'
  | 'sale'
  | 'user'
  | 'review'
  | 'coupon'
  | 'metrics';

export interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  targetId: string;
  targetType: AuditTargetType;
  metadata: Record<string, unknown>;
  ip?: string;
  device?: string;
  platform?: string;
  appVersion?: string;
  createdAt: Date;
}
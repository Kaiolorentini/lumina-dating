// ============================================
// ADMIN TYPES — MARKETPLACE
//
// AdminMetrics é cache operacional.
// NÃO é fonte definitiva de dados.
// Reconstruir via onRebuildMetrics quando necessário.
// ============================================

export interface AdminMetrics {
  totalSales: number;
  totalCommission: number;
  totalCreators: number;
  totalProducts: number;
  pendingProducts: number;
  pendingWithdrawals: number;
  totalWithdrawn: number;
  totalPendingSales: number;
  totalRefunds: number;
  monthlyRevenue: number;
  monthlyCommission: number;
  totalDownloads: number;
  totalProductsSold: number;
  activeCreators: number;
  activeProducts: number;
  todaySales: number;
  todayRevenue: number;
  totalChargebacks: number;
  updatedAt: Date;
  lastRebuiltAt?: Date;
}

export interface AppSettings {
  marketplaceEnabled: boolean;
  creatorApprovalRequired: boolean;
  commissionRate: number;
  minimumWithdrawal: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  maxUploadSizeBytes: number;
  maxProductFiles: number;
  maxPreviewFiles: number;
  supportEmail: string;
  termsVersion: string;
  paymentProvider: 'asaas';
  pixExpirationMinutes: number;
  cardPollingMinutes: number;
  signedUrlExpirationMinutes: number;
  defaultPageSize: number;
}
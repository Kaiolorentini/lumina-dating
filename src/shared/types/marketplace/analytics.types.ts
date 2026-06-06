// ============================================
// ANALYTICS TYPES — MARKETPLACE
//
// Distributed counters para views e downloads.
// ============================================

export interface AnalyticsShards {
  s0: number;
  s1: number;
  s2: number;
  s3: number;
  s4: number;
}

export interface ProductAnalytics {
  productId: string;
  viewShards: AnalyticsShards;
  downloadShards: AnalyticsShards;
  favorites: number;
  sales: number;
  lastUpdated: Date;
}
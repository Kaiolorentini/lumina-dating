// ============================================
// LUMINA — DASHBOARD METRICS SERVICE v2.0
// functions/src/gamification/dashboard/DashboardMetricsService.ts
//
// SPRINT 1C — v2.0: usa ShadowMetricsService.getAllScores()
// em vez do método removido ShadowComparisonService.getComparisonScore().
// ============================================

import * as admin from 'firebase-admin';
import { ShadowMetricsService } from '../shadow/ShadowMetricsService';
import { LegacyFeatureFlags }   from '../featureflags/LegacyFeatureFlags';

const db = admin.firestore();

export interface RatePerMinute {
  eventsPerMin:      number;
  xpPerMin:          number;
  fragmentsPerMin:   number;
  rankingPerMin:     number;
  achievementPerMin: number;
}

export interface QueueMetrics {
  retryQueueSize:      number;
  deadLetterQueueSize: number;
}

export interface DispatcherErrorRate {
  dispatcher: string;
  total:      number;
  failed:     number;
  errorRate:  number;
}

export interface DashboardSnapshot {
  generatedAt:      string;
  rates:            RatePerMinute;
  queues:           QueueMetrics;
  dispatcherErrors: DispatcherErrorRate[];
  shadowScores:     Awaited<ReturnType<typeof ShadowMetricsService.getAllScores>>;
  legacyFlags:      Awaited<ReturnType<typeof LegacyFeatureFlags.getState>>;
  avgLatencyMs:     number;
}

const WINDOW_MIN = 5;

async function getRecentLedgerEntries() {
  const since = new Date(Date.now() - WINDOW_MIN * 60_000);
  const snap  = await db.collection('eventLedger')
    .where('processedAt', '>=', since)
    .limit(1000)
    .get();
  return snap.docs.map(d => d.data());
}

function calcRates(entries: Record<string, unknown>[]): RatePerMinute {
  const div = WINDOW_MIN;
  const count = (type: string) => entries.filter(e => e.eventType === type).length;

  return {
    eventsPerMin:      Math.round(entries.length / div),
    xpPerMin:          Math.round(entries.filter(e => (e.dispatchersExecuted as string[] ?? []).includes('XP')).length / div),
    fragmentsPerMin:   Math.round(entries.filter(e => (e.dispatchersExecuted as string[] ?? []).includes('VAULT')).length / div),
    rankingPerMin:     Math.round(count('MATCH_CREATED') / div),
    achievementPerMin: Math.round(entries.filter(e => (e.dispatchersExecuted as string[] ?? []).includes('ACHIEVEMENT')).length / div),
  };
}

function calcDispatcherErrors(entries: Record<string, unknown>[]): DispatcherErrorRate[] {
  const byDispatcher = new Map<string, { total: number; failed: number }>();

  for (const entry of entries) {
    const executed = (entry.dispatchersExecuted as string[]) ?? [];
    const skipped   = (entry.dispatchersSkipped as string[]) ?? [];
    const errors    = (entry.errors as string[]) ?? [];

    for (const d of [...executed, ...skipped]) {
      const curr = byDispatcher.get(d) ?? { total: 0, failed: 0 };
      curr.total += 1;
      if (errors.some(e => e.startsWith(d))) curr.failed += 1;
      byDispatcher.set(d, curr);
    }
  }

  return Array.from(byDispatcher.entries()).map(([dispatcher, v]) => ({
    dispatcher,
    total:     v.total,
    failed:    v.failed,
    errorRate: v.total > 0 ? (v.failed / v.total) * 100 : 0,
  }));
}

async function getQueueMetrics(): Promise<QueueMetrics> {
  const safeCount = async (collection: string): Promise<number> => {
    try {
      const snap = await db.collection(collection).limit(500).get();
      return snap.size;
    } catch {
      return 0;
    }
  };

  const [retryQueueSize, deadLetterQueueSize] = await Promise.all([
    safeCount('eventRetryQueue'),
    safeCount('eventDeadLetterQueue'),
  ]);

  return { retryQueueSize, deadLetterQueueSize };
}

export const DashboardMetricsService = {

  async getSnapshot(): Promise<DashboardSnapshot> {
    const entries = await getRecentLedgerEntries();
    const avgLatency = entries.length > 0
      ? entries.reduce((sum, e) => sum + ((e.totalDurationMs as number) ?? 0), 0) / entries.length
      : 0;

    const [queues, legacyFlags, shadowScores] = await Promise.all([
      getQueueMetrics(),
      LegacyFeatureFlags.getState(),
      ShadowMetricsService.getAllScores(),
    ]);

    return {
      generatedAt:      new Date().toISOString(),
      rates:            calcRates(entries),
      queues,
      dispatcherErrors: calcDispatcherErrors(entries),
      shadowScores,
      legacyFlags,
      avgLatencyMs: Math.round(avgLatency),
    };
  },
};
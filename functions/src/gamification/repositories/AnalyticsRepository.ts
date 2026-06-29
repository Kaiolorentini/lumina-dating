// ============================================
// LUMINA — ANALYTICS REPOSITORY v1.0
// functions/src/gamification/repositories/AnalyticsRepository.ts
//
// RESPONSABILIDADE ÚNICA: acesso ao Firestore para analytics.
// Remove acesso direto do GamificationIntegrationService.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

export const AnalyticsRepository = {
  async record(payload: {
    eventType:     string;
    uid:           string;
    correlationId: string;
    status:        'started' | 'completed' | 'failed';
    meta?:         Record<string, unknown>;
  }): Promise<void> {
    await db.collection('gamificationAnalytics').add({
      ...payload,
      ...payload.meta,
      timestamp: FieldValue.serverTimestamp(),
    }).catch(() => { /* analytics nunca bloqueia */ });
  },
};
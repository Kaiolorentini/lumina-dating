// ============================================
// LUMINA — HEALTH CHECK CF v1.0
// functions/src/gamification/health/healthCheck.ts
//
// CF pública para monitoramento externo (UptimeRobot, etc.)
// e para o Dashboard interno.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import { GamificationHealthService } from './GamificationHealthService';

export const gamificationHealthCheck = functions.onRequest(
  { region: 'us-central1', cors: true },
  async (req, res) => {
    const report = await GamificationHealthService.checkHealth();

    const httpStatus = report.status === 'CRITICAL' ? 503
                      : report.status === 'WARNING'  ? 200
                      : 200;

    res.status(httpStatus).json(report);
  }
);
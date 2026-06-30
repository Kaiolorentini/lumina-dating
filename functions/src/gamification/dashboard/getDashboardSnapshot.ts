// ============================================
// LUMINA — GET DASHBOARD SNAPSHOT v1.0
// functions/src/gamification/dashboard/getDashboardSnapshot.ts
//
// CF chamada pelo painel admin (web) para exibir
// o Gamification Dashboard em tempo real.
// Restrita a SuperAdmins.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import { DashboardMetricsService } from './DashboardMetricsService';
import { assertIsSuperAdmin }      from '../../utils/isSuperAdmin';

export const getDashboardSnapshot = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    await assertIsSuperAdmin(uid);

    return DashboardMetricsService.getSnapshot();
  }
);
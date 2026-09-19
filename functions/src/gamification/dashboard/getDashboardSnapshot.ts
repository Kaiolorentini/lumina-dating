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
// Antes usava o assertIsSuperAdmin do utils/isSuperAdmin.ts —
// uma SEGUNDA implementação da mesma checagem, que NÃO conferia
// isBlocked e não tinha cache. Um superadmin bloqueado era
// barrado nas outras 21 functions e passava aqui. Arquivo
// apagado; fonte única agora é o adminGuard.
import { assertSuperAdmin }        from '../../utils/adminGuard';

export const getDashboardSnapshot = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    await assertSuperAdmin(uid);

    return DashboardMetricsService.getSnapshot();
  }
);
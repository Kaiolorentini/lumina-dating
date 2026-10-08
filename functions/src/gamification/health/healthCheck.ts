// ============================================
// LUMINA — HEALTH CHECK CF v2.0
// functions/src/gamification/health/healthCheck.ts
//
// v2.0 (auditoria A6, 08/10/2026) — FECHADA AO PÚBLICO.
// A v1 era uma URL pública (onRequest, cors: true, sem login):
// qualquer pessoa podia chamar em loop — cada chamada grava em
// _health/ping e lê eventLedger e eventDeadLetterQueue, custo na
// conta — e recebia números internos da gamificação.
//
// Agora é callable e SÓ o superadmin chama. Nome novo
// (getGamificationHealth) porque o Firebase não troca uma função
// HTTP por callable mantendo o mesmo nome: a antiga é apagada no
// deploy (firebase functions:delete gamificationHealthCheck).
// ============================================

import { onCall } from 'firebase-functions/v2/https';
import { assertAuthenticated, assertSuperAdmin } from '../../utils/adminGuard';
import { GamificationHealthService } from './GamificationHealthService';

export const getGamificationHealth = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    await assertSuperAdmin(request.auth!.uid);

    return GamificationHealthService.checkHealth();
  }
);

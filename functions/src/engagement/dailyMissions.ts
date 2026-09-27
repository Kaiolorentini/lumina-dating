// ============================================
// LUMINA — DAILY MISSIONS v6.0
// functions/src/engagement/dailyMissions.ts
//
// v6.0:
// - Catálogo e sorteio no missionsCatalog.ts (fonte única).
// - Geração com create(): o set() anterior podia APAGAR progresso
//   se um evento do servidor já tivesse criado o dia.
// - progressMission aceita só missões que o servidor confere
//   sozinho (perfil completo). As outras são registradas pelas
//   CFs onde o evento acontece.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { MissionService } from '../gamification/services/MissionService';
import { ValidationError } from '../gamification/ErrorBoundary';
import { todayBr } from '../utils/dateBr';
import { buildDailyMissionsDoc, isMarketplaceOpen } from './missionsCatalog';

const db = admin.firestore();

/** Documento do dia; gera se não existir, sem sobrescrever. */
async function ensureTodayMissions(
  uid: string,
): Promise<{ data: Record<string, unknown>; generated: boolean }> {
  const dateStr = todayBr();
  const ref     = db.collection('dailyMissions').doc(`${uid}_${dateStr}`);
  const snap    = await ref.get();

  if (snap.exists) return { data: snap.data()!, generated: false };

  const built = buildDailyMissionsDoc(uid, dateStr, await isMarketplaceOpen());

  try {
    await ref.create({ ...built, generatedAt: FieldValue.serverTimestamp() });
    return { data: built, generated: true };
  } catch (err: unknown) {
    const code = (err as { code?: number | string })?.code;
    // 6 = ALREADY_EXISTS: um evento criou o dia neste intervalo.
    if (code === 6 || code === 'already-exists') {
      const again = await ref.get();
      return { data: again.data() ?? built, generated: false };
    }
    throw err;
  }
}

// ── CF 1 — Gerar missões do dia ──
export const generateDailyMissions = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { data, generated } = await ensureTodayMissions(uid);
    return { missions: data.missions, special: data.special, generated };
  }
);

// ── CF 2 — Buscar missões do dia ──
export const getDailyMissions = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const [{ data }, walletDoc] = await Promise.all([
      ensureTodayMissions(uid),
      db.collection('wallets').doc(uid).get(),
    ]);
    const wallet = walletDoc.data() ?? {};

    return {
      missions:                data.missions,
      special:                 data.special,
      fragments:               wallet.fragments      ?? 0,
      coinsGratuitos:          wallet.coinsGratuitos ?? 0,
      fragmentsEarnedToday:    data.fragmentsEarnedToday ?? 0,
      crystalsEarnedToday:     data.crystalsEarnedToday  ?? 0,
      allCompleteBonusClaimed: data.allCompleteBonusClaimed ?? false,
    };
  }
);

// ── CF 3 — Pedido do app (só missões verificáveis) ──
export const progressMission = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { missionIdParam } = (request.data ?? {}) as { missionIdParam?: unknown };
    if (typeof missionIdParam !== 'string' || !missionIdParam) {
      throw new functions.HttpsError('invalid-argument', 'missionIdParam obrigatório.');
    }

    try {
      const result = await MissionService.claimVerifiable(uid, missionIdParam);
      return {
        success:          true,
        alreadyCompleted: result === null,
        duplicate:        result?.duplicate ?? false,
        completed:        result?.completed ?? true,
        fragments:        result?.fragments ?? 0,
        crystals:         result?.crystals  ?? 0,
        progress:         result?.progress  ?? 0,
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        const httpCode = error.fatal ? 'not-found' : 'failed-precondition';
        throw new functions.HttpsError(httpCode, error.message);
      }
      throw new functions.HttpsError('internal', 'Erro ao registrar a missão.');
    }
  }
);
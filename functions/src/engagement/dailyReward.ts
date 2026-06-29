// ============================================
// LUMINA — DAILY REWARD CLOUD FUNCTION v5.1
// functions/src/engagement/dailyReward.ts
//
// REGRAS ANTIFRAUDE APLICADAS:
// 1. Nenhum crédito client-side
// 2. runTransaction() obrigatório
// 3. Idempotência: uid + data (YYYY-MM-DD)
// 4. Limite diário: 1x por dia
// 5. serverTimestamp() — nunca Date.now() cliente
// 6. Streak: máx 7 dias (reinicia após 48h sem login)
// 20. auditLog para toda movimentação
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

// Recompensas por dia de streak (1–7)
const STREAK_REWARDS: Record<number, number> = {
  1: 5,
  2: 8,
  3: 10,
  4: 12,
  5: 15,
  6: 18,
  7: 25,  // dia 7 — bônus especial
};

export const claimDailyReward = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new functions.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const walletRef  = db.collection('wallets').doc(uid);
    const rewardRef  = db.collection('dailyRewards').doc(uid);
    const auditRef   = db.collection('wallets').doc(uid).collection('auditLog');

    // Data do servidor (YYYY-MM-DD UTC)
    const todayStr = new Date().toISOString().slice(0, 10);

    try {
      const result = await db.runTransaction(async (t) => {
        const [rewardDoc, walletDoc] = await Promise.all([
          t.get(rewardRef),
          t.get(walletRef),
        ]);

        const rewardData = rewardDoc.data() ?? {};
        const walletData = walletDoc.data() ?? {};

        // ── REGRA 3 + 4: Idempotência e limite diário ──
        if (rewardData.lastClaimedDate === todayStr) {
          throw new functions.HttpsError(
            'already-exists',
            'Recompensa diária já resgatada hoje.'
          );
        }

        // ── REGRA 6: Calcular streak ──
        // Se último claim foi ontem → incrementa streak
        // Se foi há 2+ dias → reseta streak para 1
        const lastDate   = rewardData.lastClaimedDate ?? '';
        const yesterday  = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);

        let currentStreak = rewardData.currentStreak ?? 0;

        if (lastDate === yesterdayStr) {
          currentStreak = Math.min(currentStreak + 1, 7); // teto 7
        } else {
          currentStreak = 1; // reinicia
        }

        const longestStreak = Math.max(
          rewardData.longestStreak ?? 0,
          currentStreak
        );

        // Cristais gratuitos a creditar
        const crystals = STREAK_REWARDS[currentStreak] ?? 5;

        // Saldo atual (apenas gratuitos — recompensa diária sempre credita gratuitos)
        const coinsGratuitos = walletData.coinsGratuitos ?? 0;

        // ── REGRA 2: runTransaction — tudo dentro ──
        // Atualizar dailyRewards
        t.set(rewardRef, {
          uid,
          lastClaimedDate: todayStr,
          currentStreak,
          longestStreak,
          totalClaimed: FieldValue.increment(crystals),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        // Creditar carteira (Gratuitos — REGRA 14/18/19)
        t.set(walletRef, {
          coinsGratuitos: FieldValue.increment(crystals),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        // ── REGRA 20: auditLog ──
        const auditDocRef = auditRef.doc(`daily_${todayStr}`);
        t.set(auditDocRef, {
          uid,
          tipo:           'RECOMPENSA_DIARIA',
          valor:          crystals,
          origem:         'dailyReward',
          streak:         currentStreak,
          saldoAnterior:  coinsGratuitos,
          saldoPosterior: coinsGratuitos + crystals,
          coinTipo:       'gratuito',
          timestamp:      FieldValue.serverTimestamp(),
        });

        return {
          crystals,
          currentStreak,
          longestStreak,
          nextReward: STREAK_REWARDS[Math.min(currentStreak + 1, 7)] ?? 25,
        };
      });

      return { success: true, ...result };

    } catch (error: unknown) {
      if (error instanceof functions.HttpsError) throw error;
      console.error('[claimDailyReward] Erro inesperado:', error);
      throw new functions.HttpsError('internal', 'Erro ao processar recompensa.');
    }
  }
);

// Busca estado atual da recompensa diária (sem modificar)
export const getDailyRewardStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new functions.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const rewardRef = db.collection('dailyRewards').doc(uid);
    const doc       = await rewardRef.get();

    if (!doc.exists) {
      return {
        alreadyClaimed: false,
        currentStreak:  0,
        longestStreak:  0,
        nextReward:     STREAK_REWARDS[1],
        streakRewards:  STREAK_REWARDS,
      };
    }

    const data       = doc.data()!;
    const todayStr   = new Date().toISOString().slice(0, 10);
    const alreadyClaimed = data.lastClaimedDate === todayStr;
    const currentStreak  = data.currentStreak ?? 0;

    return {
      alreadyClaimed,
      currentStreak,
      longestStreak:  data.longestStreak ?? 0,
      totalClaimed:   data.totalClaimed  ?? 0,
      nextReward:     STREAK_REWARDS[Math.min(currentStreak + (alreadyClaimed ? 0 : 1), 7)] ?? 25,
      todayReward:    STREAK_REWARDS[Math.min(currentStreak + 1, 7)] ?? 25,
      streakRewards:  STREAK_REWARDS,
    };
  }
);
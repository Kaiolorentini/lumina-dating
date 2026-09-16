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
import { todayBr, yesterdayBr } from '../utils/dateBr';
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

    // Data do servidor em BRT (YYYY-MM-DD).
    // Em UTC, o dia virava às 21h e o usuário podia resgatar duas
    // vezes na mesma noite — ou perder o streak resgatando às 20h.
    const todayStr = todayBr();

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
        const lastDate     = rewardData.lastClaimedDate ?? '';
        const yesterdayStr = yesterdayBr();

        let currentStreak = rewardData.currentStreak ?? 0;

        // daysStreak conta os dias consecutivos REAIS, sem teto.
        // currentStreak tem teto 7 porque STREAK_REWARDS só define
        // recompensa até o dia 7 — é a régua do prêmio, não do tempo.
        // Sem esta separação, STREAK_30 (target 30) era matemática-
        // mente inalcançável: currentStreak e longestStreak param
        // ambos em 7.
        let daysStreak = rewardData.daysStreak ?? 0;

        if (lastDate === yesterdayStr) {
          currentStreak = Math.min(currentStreak + 1, 7); // teto 7
          daysStreak   += 1;                              // sem teto
        } else {
          currentStreak = 1; // reinicia
          daysStreak    = 1;
        }

        const longestStreak = Math.max(
          rewardData.longestStreak ?? 0,
          currentStreak
        );

        // Recorde de dias consecutivos, também sem teto.
        const longestDaysStreak = Math.max(
          rewardData.longestDaysStreak ?? 0,
          daysStreak
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
          daysStreak,
          longestDaysStreak,
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
          daysStreak,
          longestDaysStreak,
          nextReward: STREAK_REWARDS[Math.min(currentStreak + 1, 7)] ?? 25,
        };
      });

    
      // Conquistas STREAK_3, STREAK_7 e STREAK_30 — fire-and-forget,
      // fora da transaction.
      //
      // STREAK_UPDATE é action ABSOLUTA no onAchievementTrigger:
      // currentValue vai direto contra o target, sem somar +1. Por
      // isso enviamos daysStreak (dias reais) e não currentStreak,
      // que para em 7 e nunca alcançaria STREAK_30.
      db.collection('achievementTriggers').add({
        uid,
        action:       'STREAK_UPDATE',
        currentValue: result.daysStreak,
        processedAt:  null,
        timestamp:    FieldValue.serverTimestamp(),
      }).catch(() => {});

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
    // Mesma fronteira do claimDailyReward — se divergirem, o modal
    // abre dizendo que há recompensa e a CF nega.
    const todayStr   = todayBr();
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
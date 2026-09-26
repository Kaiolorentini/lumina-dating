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
import { PrestigeService } from './prestigeService';
const db = admin.firestore();

// Marcos de tempo do prestígio. O `checkPrestigeTimeMarcos`
// agendado foi REMOVIDO: ele varria 200 usuários por dia,
// detectava o marco e gravava em `pendingMarcos` — campo que
// NINGUÉM lia. Os pontos nunca eram creditados.
//
// Aqui o custo é zero: o resgate diário já roda uma vez por
// dia por usuário e já tem a transação aberta. E escala
// sozinho, sem o teto de 200.
const TIME_MARCOS: { id: string; days: number }[] = [
  { id: 'ACTIVE_365_DAYS', days: 365 },
  { id: 'ACTIVE_180_DAYS', days: 180 },
  { id: 'ACTIVE_90_DAYS',  days: 90  },
  { id: 'ACTIVE_30_DAYS',  days: 30  },
];

// Recompensas por dia de streak (1–7).
//
// Valores CORTADOS PELA METADE: o ciclo dava 93 cristais por
// semana só por abrir o app, o que competia com a compra e
// com o Cofre, que exige interação real. Agora dá 47.
//
// A curva foi mantida: o dia 7 continua valendo mais do que o
// dobro do dia 1, que é o que sustenta o streak.
const STREAK_REWARDS: Record<number, number> = {
  1: 3,
  2: 4,
  3: 5,
  4: 6,
  5: 8,
  6: 9,
  7: 12,  // dia 7 — bônus especial
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

        // Dias ATIVOS: distintos, não consecutivos. Quem entra
        // três vezes por semana durante um ano acumula os 30,
        // só mais devagar. É o comportamento certo para o
        // prestígio, que por diretriz nunca diminui.
        //
        // O incremento é seguro porque este ponto só é alcançado
        // quando `lastClaimedDate !== todayStr` — o guard de
        // idempotência acima já barrou o segundo resgate do dia.
        const activeDays = (rewardData.activeDays ?? 0) + 1;

        // Cristais gratuitos a creditar
        const crystals = STREAK_REWARDS[currentStreak] ?? STREAK_REWARDS[1];

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
          activeDays,
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
          activeDays,
          nextReward: STREAK_REWARDS[Math.min(currentStreak + 1, 7)] ?? STREAK_REWARDS[7],
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

      // Marcos de TEMPO do prestígio. Fora da transação e
      // fire-and-forget: prestígio é cosmético e não pode
      // derrubar o resgate.
      //
      // A lista está em ordem DECRESCENTE e o laço para no
      // primeiro que bate: quem cruza 365 não precisa que o
      // ACTIVE_30 seja reavaliado, e o próprio grantMarco
      // barra o que já foi concedido.
      //
      // ACTIVE_30_DAYS é repetível sem limite: a cada 30 dias
      // ativos rende 100 pontos de novo. Por isso a checagem
      // por múltiplo, e não por "maior ou igual" simples.
      for (const marco of TIME_MARCOS) {
        if (result.activeDays === marco.days) {
          PrestigeService.grantMarco(uid, marco.id).catch(() => {});
          break;
        }
        // O de 30 dias repete a cada 30: 30, 60, 90, 120…
        if (marco.id === 'ACTIVE_30_DAYS' && result.activeDays % 30 === 0) {
          PrestigeService.grantMarco(uid, marco.id).catch(() => {});
          break;
        }
      }

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
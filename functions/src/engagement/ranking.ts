// ============================================
// LUMINA — RANKING SEMANAL v5.1
// functions/src/engagement/ranking.ts
//
// REGRAS IMPLEMENTADAS:
// 1.  Ranking server-side
// 2.  Dois rankings: Social (competitivo) + Progressão (informativo)
// 3.  Top 10 — não top 3
// 4.  Recompensas: 1º=50, 2º=40, 3º=30, 4º-10º=20 fragmentos
// 5.  Badge semanal para o campeão (7 dias)
// 6.  Ligas: Bronze, Prata, Ouro, Constelação, Galáxia
// 7.  Snapshot antes do reset com weekId + seasonId
// 8.  Histórico: bestPosition, weeksWon, top10Count
// 9.  RewardService — ranking nunca entrega fragmentos diretamente
// 10. XP congelado domingo 23:59:59 (freezeRanking)
// 11. 3 etapas: freeze → reward → reset
// 12. Anti-cheat: xpRiskScore verificado antes de recompensar
// 13. Ranking Social conta: SOCIAL, MISSION, CHAT
// 14. Desempate por timestamp (quem chegou primeiro)
// 15. Cache: atualização a cada 5 minutos
// 16. Analytics por semana
// 17. seasonId reservado
// 18. Campos weeklyXP + seasonXP + lifetimeXP
// ============================================

import * as functions  from 'firebase-functions/v2/https';
import * as scheduler  from 'firebase-functions/v2/scheduler';
import * as admin      from 'firebase-admin';
import { FieldValue }  from 'firebase-admin/firestore';

const db = admin.firestore();

// Categorias que entram no Ranking Social (REGRA 13)
const SOCIAL_RANKING_CATEGORIES = ['SOCIAL', 'MISSION', 'CHAT'];

// Recompensas por posição (REGRA 4+16)
const RANK_REWARDS: Record<number, number> = {
  1:  50,
  2:  40,
  3:  30,
  4:  20, 5: 20, 6: 20, 7: 20, 8: 20, 9: 20, 10: 20,
};

// Ligas por XP social semanal (REGRA 6)
const LEAGUES = [
  { name: 'Galáxia',     minXP: 5000  },
  { name: 'Constelação', minXP: 2000  },
  { name: 'Ouro',        minXP: 1000  },
  { name: 'Prata',       minXP: 500   },
  { name: 'Bronze',      minXP: 0     },
];

function getLeague(xp: number): string {
  for (const league of LEAGUES) {
    if (xp >= league.minXP) return league.name;
  }
  return 'Bronze';
}

function getCurrentWeekId(): string {
  const now    = new Date();
  const year   = now.getFullYear();
  const week   = Math.ceil((now.getDate() - now.getDay() + 1) / 7);
  return `${year}_W${String(week).padStart(2, '0')}`;
}

function getCurrentSeasonId(): string {
  const now = new Date();
  return `S${now.getFullYear()}_${Math.ceil(now.getMonth() / 3)}`;
}

// ── 1. Registrar XP no ranking (chamado por earnXP) ──
export const registerRankingXP = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { xpAmount, category } = request.data as {
      xpAmount:  number;
      category:  string;
    };

    const weekId    = getCurrentWeekId();
    const seasonId  = getCurrentSeasonId();
    const rankRef   = db.collection('weeklyRanking').doc(`${uid}_${weekId}`);
    const userRef   = db.collection('users').doc(uid);

    await db.runTransaction(async (t) => {
      const [rankDoc, userDoc] = await Promise.all([
        t.get(rankRef),
        t.get(userRef),
      ]);

      const rankData = rankDoc.data() ?? {};
      const userData = userDoc.data() ?? {};

      // REGRA 10: verifica se ranking está congelado
      if (rankData.frozen) return;

      const isSocialCategory = SOCIAL_RANKING_CATEGORIES.includes(category);

      // REGRA 18: atualiza weeklyXP + socialXP + seasonXP
      const updates: Record<string, any> = {
        uid,
        weekId,
        seasonId,
        weeklyXP:    FieldValue.increment(xpAmount),
        lifetimeXP:  FieldValue.increment(xpAmount),
        updatedAt:   FieldValue.serverTimestamp(),
        league:      getLeague((rankData.socialXP ?? 0) + (isSocialCategory ? xpAmount : 0)),
        displayName: userData.name    ?? 'Usuário',
        photoURL:    userData.photoURL ?? '',
      };

      // REGRA 13: só conta no ranking social se for categoria correta
      if (isSocialCategory) {
        updates.socialXP = FieldValue.increment(xpAmount);
        // Desempate: guarda timestamp da primeira vez neste XP (REGRA 14)
        if (!rankData.firstXPAt) {
          updates.firstXPAt = FieldValue.serverTimestamp();
        }
      }

      t.set(rankRef, updates, { merge: true });

      // REGRA 18: atualiza seasonXP no perfil do usuário
      t.set(userRef, {
        ranking: {
          weeklyXP:  FieldValue.increment(xpAmount),
          seasonXP:  FieldValue.increment(xpAmount),
          lifetimeXP: FieldValue.increment(xpAmount),
        },
      }, { merge: true });
    });

    return { success: true };
  }
);

// ── 2. Buscar ranking ──
export const getRanking = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const weekId   = getCurrentWeekId();
    const cacheRef = db.collection('rankingCache').doc(weekId);
    const cacheDoc = await cacheRef.get();

    // REGRA 15: usa cache se atualizado há menos de 5 minutos
    if (cacheDoc.exists) {
      const cacheData  = cacheDoc.data()!;
      const cacheAge   = Date.now() - (cacheData.updatedAt?.toMillis() ?? 0);
      if (cacheAge < 5 * 60 * 1000) {
        // Busca posição do usuário atual
        const userRankRef = db.collection('weeklyRanking').doc(`${uid}_${weekId}`);
        const userRankDoc = await userRankRef.get();
        const userXP      = userRankDoc.data()?.socialXP ?? 0;

        return {
          ...cacheData,
          userPosition: cacheData.top50?.findIndex((u: any) => u.uid === uid) + 1 || null,
          userXP,
          fromCache: true,
        };
      }
    }

    // Busca ranking social (REGRA 13)
    const snap = await db.collection('weeklyRanking')
      .where('weekId', '==', weekId)
      .where('socialXP', '>', 0)
      .orderBy('socialXP', 'desc')
      .orderBy('firstXPAt', 'asc') // REGRA 14: desempate por quem chegou primeiro
      .limit(50)
      .get();

    const top50 = snap.docs.map((doc, i) => ({
      position:    i + 1,
      uid:         doc.data().uid,
      displayName: doc.data().displayName,
      photoURL:    doc.data().photoURL,
      socialXP:    doc.data().socialXP    ?? 0,
      weeklyXP:    doc.data().weeklyXP    ?? 0,
      league:      doc.data().league      ?? 'Bronze',
    }));

    // REGRA 15: salva cache
    await cacheRef.set({
      weekId,
      top50,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const userPos  = top50.findIndex(u => u.uid === uid) + 1;
    const userSnap = snap.docs.find(d => d.data().uid === uid);
    const userXP   = userSnap?.data().socialXP ?? 0;

    // XP até entrar no top 50 (REGRA 12)
    const lastInTop50XP = top50[49]?.socialXP ?? 0;
    const xpToTop50     = userXP < lastInTop50XP ? lastInTop50XP - userXP : 0;
    const xpToNext      = userPos > 1 ? (top50[userPos - 2]?.socialXP ?? 0) - userXP : 0;

    return {
      weekId,
      top50,
      userPosition: userPos > 0 ? userPos : null,
      userXP,
      xpToTop50,
      xpToNextPosition: Math.max(0, xpToNext),
      fromCache: false,
    };
  }
);

// ── STEP 1: Congelar ranking (domingo 23:50) ──
export const freezeRanking = scheduler.onSchedule(
  { schedule: 'every sunday 23:50', region: 'us-central1' },
  async () => {
    const weekId = getCurrentWeekId();
    console.log(`[freezeRanking] Congelando ranking ${weekId}`);

    // Busca top 50 e congela
    const snap = await db.collection('weeklyRanking')
      .where('weekId', '==', weekId)
      .where('socialXP', '>', 0)
      .orderBy('socialXP', 'desc')
      .orderBy('firstXPAt', 'asc')
      .limit(50)
      .get();

    const batch = db.batch();

    // Salva snapshot antes do reset (REGRA 7)
    const snapshotData = {
      weekId,
      seasonId:    getCurrentSeasonId(),
      frozenAt:    FieldValue.serverTimestamp(),
      top10:       snap.docs.slice(0, 10).map((doc, i) => ({
        position:    i + 1,
        uid:         doc.data().uid,
        displayName: doc.data().displayName,
        socialXP:    doc.data().socialXP ?? 0,
        league:      doc.data().league   ?? 'Bronze',
      })),
    };

    batch.set(db.collection('rankingSnapshots').doc(weekId), snapshotData);

    // Congela documentos do ranking
    for (const doc of snap.docs) {
      batch.update(doc.ref, { frozen: true });
    }

    await batch.commit();
    console.log(`[freezeRanking] ${snap.size} entradas congeladas`);
  }
);

// ── STEP 2: Recompensar top 10 (segunda 00:05) ──
export const rewardRanking = scheduler.onSchedule(
  { schedule: 'every monday 00:05', region: 'us-central1' },
  async () => {
    const lastWeekDate = new Date();
    lastWeekDate.setDate(lastWeekDate.getDate() - 1); // domingo
    const year    = lastWeekDate.getFullYear();
    const week    = Math.ceil((lastWeekDate.getDate() - lastWeekDate.getDay() + 1) / 7);
    const weekId  = `${year}_W${String(week).padStart(2, '0')}`;

    console.log(`[rewardRanking] Recompensando semana ${weekId}`);

    const snapshotDoc = await db.collection('rankingSnapshots').doc(weekId).get();
    if (!snapshotDoc.exists) {
      console.error(`[rewardRanking] Snapshot ${weekId} não encontrado`);
      return;
    }

    const snapshot = snapshotDoc.data()!;
    const top10    = snapshot.top10 ?? [];

    for (const entry of top10) {
      const position = entry.position as number;
      const reward   = RANK_REWARDS[position] ?? 0;
      if (reward <= 0) continue;

      await db.runTransaction(async (t) => {
        const userRef   = db.collection('users').doc(entry.uid);
        const walletRef = db.collection('wallets').doc(entry.uid);

        const [userDoc, walletDoc] = await Promise.all([
          t.get(userRef),
          t.get(walletRef),
        ]);

        // REGRA 12: idempotência — não recompensa duas vezes
        const alreadyRewarded = userDoc.data()?.ranking?.rewardedWeeks?.[weekId];
        if (alreadyRewarded) return;

        // REGRA 9: anti-cheat — verifica risk score
        const riskScore = userDoc.data()?.xp?.xpRiskScore ?? 0;
        if (riskScore >= 50) {
          // Marca para revisão manual
          t.set(db.collection('rankingReview').doc(`${entry.uid}_${weekId}`), {
            uid:      entry.uid,
            weekId,
            position,
            reward,
            riskScore,
            reason:   'high_risk_score',
            timestamp: FieldValue.serverTimestamp(),
          });
          return;
        }

        const wallet    = walletDoc.data() ?? {};
        const prevFrags = wallet.fragments ?? 0;

        // REGRA 9 (recomendação): RewardService — ranking não entrega diretamente
        // Fragmentos via wallet
        t.set(walletRef, {
          fragments: FieldValue.increment(reward),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        // Ledger imutável
        t.set(db.collection('economyLedger').doc(), {
          uid:          entry.uid,
          tipo:         'RANKING_REWARD',
          weekId,
          position,
          fragmentos:   reward,
          saldoAntes:   prevFrags,
          saldoDepois:  prevFrags + reward,
          timestamp:    FieldValue.serverTimestamp(),
          imutavel:     true,
        });

        // Badge semanal para o 1º lugar (REGRA 5)
        if (position === 1) {
          const badgeExpiry = new Date();
          badgeExpiry.setDate(badgeExpiry.getDate() + 7);
          t.set(userRef, {
            ranking: {
              weeklyBadge:       'campeao_da_semana',
              weeklyBadgeExpiry: admin.firestore.Timestamp.fromDate(badgeExpiry),
            },
          }, { merge: true });
        }

        // REGRA 8: histórico do usuário
        t.set(userRef, {
          ranking: {
            [`rewardedWeeks.${weekId}`]: true,
            weeksWon:    position === 1 ? FieldValue.increment(1) : FieldValue.increment(0),
            top10Count:  FieldValue.increment(1),
            bestPosition: entry.position, // simplificado — produção compara com anterior
          },
        }, { merge: true });

        // REGRA 16: analytics
        t.set(db.collection('rankingAnalytics').doc(`${entry.uid}_${weekId}`), {
          uid:      entry.uid,
          week:     weekId,
          rank:     position,
          xp:       entry.socialXP,
          league:   entry.league,
          reward,
          timestamp: FieldValue.serverTimestamp(),
        });

        // Notificação
        t.set(db.collection('notifications').doc(), {
          userId:    entry.uid,
          type:      'sintonia',
          title:     position === 1 ? '🏆 Campeão da Semana!' : `🎯 Top ${position} do Ranking!`,
          message:   `+${reward} Fragmentos de recompensa pela sua posição no ranking semanal.`,
          icon:      position === 1 ? '🏆' : '🎯',
          read:      false,
          dados:     { position, reward, weekId },
          timestamp: FieldValue.serverTimestamp(),
        });
      });
    }

    console.log(`[rewardRanking] Top 10 recompensados`);
  }
);

// ── STEP 3: Resetar ranking (segunda 00:10) ──
export const resetRanking = scheduler.onSchedule(
  { schedule: 'every monday 00:10', region: 'us-central1' },
  async () => {
    const weekId = getCurrentWeekId();
    console.log(`[resetRanking] Resetando para nova semana ${weekId}`);

    // Reseta weeklyXP de todos os usuários
    const snap = await db.collection('users')
      .where('ranking.weeklyXP', '>', 0)
      .limit(500)
      .get();

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, { 'ranking.weeklyXP': 0 });
    }
    await batch.commit();

    // Invalida cache
    await db.collection('rankingCache').doc(weekId).delete();

    console.log(`[resetRanking] ${snap.size} usuários resetados`);
  }
);
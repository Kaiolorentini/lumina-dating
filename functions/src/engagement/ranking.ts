// ============================================
// LUMINA — RANKING SEMANAL v6.0
// functions/src/engagement/ranking.ts
//
// v6.0 (27/09):
// - registerRankingXP REMOVIDA: callable em que o APP escolhia
//   quanto XP de ranking recebia (sem teto, aceitava negativo).
//   Bastava mandar 1.000.000 para ser 1º toda semana: 50
//   fragmentos, badge de Campeão e conquista. Nenhuma tela a
//   chamava — quem alimenta o ranking é o Engine, pelo
//   RankingRepository, no servidor.
// - Rotinas no horário de BRASÍLIA. Sem timeZone rodavam em UTC:
//   congelavam o ranking às 20h50 de domingo (3h antes do fim da
//   semana), premiavam com uma semana de atraso e zeravam a
//   semana em curso. Os ids de semana (weekIdBr) já eram BRT;
//   só o horário de disparo muda — nenhuma chave muda.
// - Trava contra pagamento em dobro CONSERTADA: gravava
//   `rewardedWeeks.<semana>` como campo literal com ponto no nome
//   (set com merge não aninha), e a checagem nunca achava nada.
// - Notificação do prêmio com tipo 'ranking_reward' (abre o
//   Ranking); melhor posição guardada de verdade; reset paginado.
// ============================================
import { auditLogFinanceiro } from '../utils/auditLogFinanceiro';
import * as functions  from 'firebase-functions/v2/https';
import * as scheduler  from 'firebase-functions/v2/scheduler';
import * as admin      from 'firebase-admin';
import { FieldValue }  from 'firebase-admin/firestore';
import { weekIdBr, lastWeekIdBr, seasonIdBr } from '../utils/dateBr';

const db = admin.firestore();

const TIME_ZONE = 'America/Sao_Paulo';

const RANK_REWARDS: Record<number, number> = {
  1: 50, 2: 40, 3: 30, 4: 20, 5: 20, 6: 20, 7: 20, 8: 20, 9: 20, 10: 20,
};

/** Tamanho do lote do reset — o limite de um batch é 500 escritas. */
const RESET_BATCH_SIZE = 400;

// ── 1. Buscar ranking ──
export const getRanking = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const weekId   = weekIdBr();
    const cacheRef = db.collection('rankingCache').doc(weekId);
    const cacheDoc = await cacheRef.get();

    if (cacheDoc.exists) {
      const cacheData = cacheDoc.data()!;
      const cacheAge  = Date.now() - (cacheData.updatedAt?.toMillis() ?? 0);
      if (cacheAge < 5 * 60 * 1000) {
        const userRankDoc = await db.collection('weeklyRanking').doc(`${uid}_${weekId}`).get();
        const userXP      = userRankDoc.data()?.socialXP ?? 0;

        return {
          ...cacheData,
          userPosition: cacheData.top50?.findIndex((u: { uid: string }) => u.uid === uid) + 1 || null,
          userXP,
          fromCache: true,
        };
      }
    }

    const snap = await db.collection('weeklyRanking')
      .where('weekId', '==', weekId)
      .where('socialXP', '>', 0)
      .orderBy('socialXP', 'desc')
      .orderBy('firstXPAt', 'asc')
      .limit(50)
      .get();

    const top50 = snap.docs.map((doc, i) => ({
      position:    i + 1,
      uid:         doc.data().uid,
      displayName: doc.data().displayName,
      photoURL:    doc.data().photoURL,
      socialXP:    doc.data().socialXP ?? 0,
      weeklyXP:    doc.data().weeklyXP ?? 0,
      league:      doc.data().league   ?? 'Bronze',
    }));

    await cacheRef.set({ weekId, top50, updatedAt: FieldValue.serverTimestamp() });

    const userPos  = top50.findIndex(u => u.uid === uid) + 1;
    const userSnap = snap.docs.find(d => d.data().uid === uid);
    const userXP   = userSnap?.data().socialXP ?? 0;

    const lastInTop50XP = top50[49]?.socialXP ?? 0;
    const xpToTop50     = userXP < lastInTop50XP ? lastInTop50XP - userXP : 0;
    const xpToNext      = userPos > 1 ? (top50[userPos - 2]?.socialXP ?? 0) - userXP : 0;

    return {
      weekId, top50,
      userPosition: userPos > 0 ? userPos : null,
      userXP, xpToTop50,
      xpToNextPosition: Math.max(0, xpToNext),
      fromCache: false,
    };
  }
);

// ── STEP 1: Congelar ranking — domingo 23:50 (BRT) ──
export const freezeRanking = scheduler.onSchedule(
  { schedule: '50 23 * * 0', timeZone: TIME_ZONE, region: 'us-central1' },
  async () => {
    const weekId = weekIdBr();
    console.log(`[freezeRanking] Congelando ranking ${weekId}`);

    const snap = await db.collection('weeklyRanking')
      .where('weekId', '==', weekId)
      .where('socialXP', '>', 0)
      .orderBy('socialXP', 'desc')
      .orderBy('firstXPAt', 'asc')
      .limit(50)
      .get();

    const batch = db.batch();

    batch.set(db.collection('rankingSnapshots').doc(weekId), {
      weekId,
      seasonId: seasonIdBr(),
      frozenAt: FieldValue.serverTimestamp(),
      top10: snap.docs.slice(0, 10).map((doc, i) => ({
        position:    i + 1,
        uid:         doc.data().uid,
        displayName: doc.data().displayName,
        socialXP:    doc.data().socialXP ?? 0,
        league:      doc.data().league   ?? 'Bronze',
      })),
    });

    for (const doc of snap.docs) {
      batch.update(doc.ref, { frozen: true });
    }

    await batch.commit();
    console.log(`[freezeRanking] ${snap.size} entradas congeladas`);
  }
);

// ── STEP 2: Recompensar top 10 — segunda 00:05 (BRT) ──
export const rewardRanking = scheduler.onSchedule(
  { schedule: '5 0 * * 1', timeZone: TIME_ZONE, region: 'us-central1' },
  async () => {
    // Segunda 00:05 BRT: a semana a premiar é a que acabou — a mesma
    // que o freezeRanking congelou no domingo às 23:50.
    const weekId = lastWeekIdBr();
    console.log(`[rewardRanking] Recompensando semana ${weekId}`);

    const snapshotDoc = await db.collection('rankingSnapshots').doc(weekId).get();
    if (!snapshotDoc.exists) {
      console.error(`[rewardRanking] Snapshot ${weekId} não encontrado`);
      return;
    }

    const top10 = (snapshotDoc.data()!.top10 ?? []) as {
      position: number; uid: string; socialXP: number; league: string;
    }[];

    for (const entry of top10) {
      const position = entry.position;
      const reward   = RANK_REWARDS[position] ?? 0;
      if (reward <= 0) continue;

      await db.runTransaction(async (t) => {
        const userRef   = db.collection('users').doc(entry.uid);
        const walletRef = db.collection('wallets').doc(entry.uid);

        const [userDoc, walletDoc] = await Promise.all([t.get(userRef), t.get(walletRef)]);
        const ranking = userDoc.data()?.ranking ?? {};

        // Trava: a semana já paga não paga de novo, mesmo se o
        // agendador repetir a execução.
        if (ranking.rewardedWeeks?.[weekId] === true) return;

        const riskScore = userDoc.data()?.xp?.xpRiskScore ?? 0;
        if (riskScore >= 50) {
          t.set(db.collection('rankingReview').doc(`${entry.uid}_${weekId}`), {
            uid: entry.uid, weekId, position, reward, riskScore,
            reason: 'high_risk_score', timestamp: FieldValue.serverTimestamp(),
          });
          return;
        }

        const prevFrags = walletDoc.data()?.fragments ?? 0;

        t.set(walletRef, {
          fragments: FieldValue.increment(reward),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        t.set(db.collection('economyLedger').doc(), {
          uid: entry.uid, tipo: 'RANKING_REWARD', weekId, position,
          fragmentos: reward, saldoAntes: prevFrags, saldoDepois: prevFrags + reward,
          timestamp: FieldValue.serverTimestamp(), imutavel: true,
        });
        auditLogFinanceiro({
          uid: entry.uid, tipo: 'FRAG_RANKING', valor: reward, origem: 'rewardRanking',
          metadata: { weekId, position },
        }, t);

        const prevBest = typeof ranking.bestPosition === 'number' ? ranking.bestPosition : Infinity;

        // Mapas ANINHADOS: set com merge não interpreta ponto no nome.
        const rankingUpdate: Record<string, unknown> = {
          rewardedWeeks: { [weekId]: true },
          top10Count:    FieldValue.increment(1),
          bestPosition:  Math.min(prevBest, position),
        };

        if (position === 1) {
          const badgeExpiry = new Date(Date.now() + 7 * 24 * 3600 * 1000);
          rankingUpdate.weeksWon          = FieldValue.increment(1);
          rankingUpdate.weeklyBadge       = 'campeao_da_semana';
          rankingUpdate.weeklyBadgeExpiry = admin.firestore.Timestamp.fromDate(badgeExpiry);
        }

        t.set(userRef, { ranking: rankingUpdate }, { merge: true });

        t.set(db.collection('rankingAnalytics').doc(`${entry.uid}_${weekId}`), {
          uid: entry.uid, week: weekId, rank: position, xp: entry.socialXP,
          league: entry.league, reward, timestamp: FieldValue.serverTimestamp(),
        });

        t.set(db.collection('notifications').doc(), {
          userId:  entry.uid,
          type:    'ranking_reward',
          title:   position === 1 ? '🏆 Campeão da Semana!' : `🎯 Top ${position} do Ranking!`,
          message: `+${reward} Fragmentos de recompensa pela sua posição no ranking semanal.`,
          icon:    position === 1 ? '🏆' : '🎯',
          read:    false,
          dados:   { position, reward, weekId },
          timestamp: FieldValue.serverTimestamp(),
        });
      });
    }

    console.log('[rewardRanking] Top 10 recompensados');
  }
);

// ── STEP 3: Resetar ranking — segunda 00:10 (BRT) ──
export const resetRanking = scheduler.onSchedule(
  { schedule: '10 0 * * 1', timeZone: TIME_ZONE, region: 'us-central1' },
  async () => {
    const weekId = weekIdBr();
    console.log(`[resetRanking] Resetando para nova semana ${weekId}`);

    // Paginado: o documento zerado sai do filtro, então cada volta
    // pega os próximos. Antes parava nos primeiros 500.
    let total = 0;
    for (;;) {
      const snap = await db.collection('users')
        .where('ranking.weeklyXP', '>', 0)
        .limit(RESET_BATCH_SIZE)
        .get();
      if (snap.empty) break;

      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.update(doc.ref, { 'ranking.weeklyXP': 0 });
      }
      await batch.commit();
      total += snap.size;

      if (snap.size < RESET_BATCH_SIZE) break;
    }

    // Os caches da semana nova e da que acabou saem.
    await db.collection('rankingCache').doc(weekId).delete().catch(() => {});
    await db.collection('rankingCache').doc(lastWeekIdBr()).delete().catch(() => {});

    console.log(`[resetRanking] ${total} usuários resetados`);
  }
);
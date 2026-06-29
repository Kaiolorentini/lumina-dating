// ============================================
// LUMINA — RANKING SEMANAL (ANTI-FARM)
// functions/src/economy/weeklyRanking.ts
// ============================================

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { TRUST_THRESHOLDS } from '../security/trustScore';

export type RankingCategory =
  | 'EXPLORADORES'
  | 'SINTONIAS'
  | 'MISSOES';

export const registerRankingEvent = onCall(
  { maxInstances: 10, region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const { category, targetUid } = request.data as {
      category:   RankingCategory;
      targetUid?: string;
    };

    if (!category) throw new HttpsError('invalid-argument', 'Category inválida.');

    const db      = admin.firestore();
    const weekId  = getCurrentWeekId();
    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async (t) => {
      const userSnap = await t.get(userRef);

      // Admin SDK: .exists é propriedade booleana, não método
      if (!userSnap.exists) return { skipped: true, reason: 'user_not_found' };

      const user = userSnap.data()!;

      if ((user.trustScore ?? 0) < TRUST_THRESHOLDS.MIN_FOR_RANKING) {
        return { skipped: true, reason: 'trust_score_too_low' };
      }

      // REGRA 13: usuário único, não evento
      if (targetUid) {
        const uniqueKey       = `${category}_${targetUid}`;
        const alreadyCounted: string[] = user.rankingUniqueCounted?.[weekId] ?? [];
        if (alreadyCounted.includes(uniqueKey)) {
          return { skipped: true, reason: 'already_counted_unique' };
        }
        t.update(userRef, {
          [`rankingUniqueCounted.${weekId}`]:
            admin.firestore.FieldValue.arrayUnion(uniqueKey),
        });
      }

      const rankingRef  = db
        .collection('weeklyRanking')
        .doc(weekId)
        .collection(category)
        .doc(uid);

      const rankingSnap = await t.get(rankingRef);

      // Admin SDK: .exists é propriedade booleana, não método
      if (rankingSnap.exists) {
        t.update(rankingRef, {
          score:     admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        t.set(rankingRef, {
          uid,
          displayName: user.name    ?? 'Usuário',
          photoURL:    user.photoURL ?? '',
          profileTier: user.progression?.profileTier ?? 'comum',
          score:       1,
          weekId,
          createdAt:   admin.firestore.FieldValue.serverTimestamp(),
          updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return { success: true };
    });
  }
);

export const resetWeeklyRanking = onSchedule(
  {
    schedule: 'every monday 00:00',
    timeZone: 'America/Sao_Paulo',
    region:   'us-central1',
  },
  async () => {
    const db         = admin.firestore();
    const prevWeekId = getPreviousWeekId();

    console.log(`[weeklyRanking] Processando semana: ${prevWeekId}`);

    for (const category of ['EXPLORADORES', 'SINTONIAS', 'MISSOES'] as RankingCategory[]) {
      await distributeRankingRewards(db, prevWeekId, category);
    }

    console.log('[weeklyRanking] Reset completo.');
  }
);

async function distributeRankingRewards(
  db: admin.firestore.Firestore,
  weekId: string,
  category: RankingCategory
): Promise<void> {
  // Recompensas em fragmentos — não inflaciona cristais
  const REWARDS_BY_POSITION = [500, 300, 200, 150, 100, 80, 60, 50, 40, 30];

  const snap = await db
    .collection('weeklyRanking')
    .doc(weekId)
    .collection(category)
    .orderBy('score', 'desc')
    .limit(10)
    .get();

  const batch = db.batch();

  snap.docs.forEach((doc, index) => {
    const entry  = doc.data();
    const reward = REWARDS_BY_POSITION[index] ?? 20;

    const userRef = db.collection('users').doc(entry.uid);
    batch.update(userRef, {
      'economy.fragments': admin.firestore.FieldValue.increment(reward),
    });

    const notifRef = db.collection('notifications').doc();
    batch.set(notifRef, {
      userId:    entry.uid,
      type:      'ranking_reward',
      message:   `🏆 Você ficou em ${index + 1}º no ranking ${category} e ganhou ${reward} fragmentos!`,
      read:      false,
      icon:      '🏆',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
}

function getCurrentWeekId(): string {
  return getMonday(new Date()).toISOString().slice(0, 10);
}

function getPreviousWeekId(): string {
  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() - 7);
  return monday.toISOString().slice(0, 10);
}

function getMonday(date: Date): Date {
  const d    = new Date(date);
  const day  = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
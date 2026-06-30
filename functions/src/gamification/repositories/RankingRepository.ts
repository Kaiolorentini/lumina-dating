// ============================================
// LUMINA — RANKING REPOSITORY v1.0
// functions/src/gamification/repositories/RankingRepository.ts
//
// SPRINT 1A — Acesso ao Firestore para Ranking.
// Mesma collection do legado (weeklyRanking) — compatível
// com freezeRanking/rewardRanking/resetRanking existentes.
// Nenhuma regra de negócio aqui.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

export interface RankingSnapshot {
  socialXP:   number;
  weeklyXP:   number;
  lifetimeXP: number;
  frozen:     boolean;
  firstXPAt:  Date | null;
}

export interface RankingWrite {
  uid:         string;
  weekId:      string;
  seasonId:    string;
  weeklyXP:    number;
  lifetimeXP:  number;
  league:      string;
  displayName: string;
  photoURL:    string;
  socialXP?:   number;
  firstXPAt?:  boolean; // true = define serverTimestamp agora
}

export const RankingRepository = {
  async getSnapshot(t: FirebaseFirestore.Transaction, uid: string, weekId: string): Promise<RankingSnapshot> {
    const doc  = await t.get(db.collection('weeklyRanking').doc(`${uid}_${weekId}`));
    const data = doc.data() ?? {};
    return {
      socialXP:   data.socialXP   ?? 0,
      weeklyXP:   data.weeklyXP   ?? 0,
      lifetimeXP: data.lifetimeXP ?? 0,
      frozen:     data.frozen     === true,
      firstXPAt:  data.firstXPAt?.toDate?.() ?? null,
    };
  },

  write(t: FirebaseFirestore.Transaction, uid: string, weekId: string, data: RankingWrite): void {
    const updates: Record<string, unknown> = {
      uid:         data.uid,
      weekId:      data.weekId,
      seasonId:    data.seasonId,
      weeklyXP:    FieldValue.increment(data.weeklyXP),
      lifetimeXP:  FieldValue.increment(data.lifetimeXP),
      league:      data.league,
      displayName: data.displayName,
      photoURL:    data.photoURL,
      updatedAt:   FieldValue.serverTimestamp(),
    };

    if (data.socialXP !== undefined) {
      updates.socialXP = FieldValue.increment(data.socialXP);
    }
    if (data.firstXPAt) {
      updates.firstXPAt = FieldValue.serverTimestamp();
    }

    t.set(db.collection('weeklyRanking').doc(`${uid}_${weekId}`), updates, { merge: true });
  },

  writeUserRankingFields(t: FirebaseFirestore.Transaction, uid: string, weeklyXP: number, seasonXP: number, lifetimeXP: number): void {
    t.set(db.collection('users').doc(uid), {
      ranking: {
        weeklyXP:   FieldValue.increment(weeklyXP),
        seasonXP:   FieldValue.increment(seasonXP),
        lifetimeXP: FieldValue.increment(lifetimeXP),
      },
    }, { merge: true });
  },
};
// ============================================
// LUMINA — RANKING SERVICE v2.0
// functions/src/gamification/services/RankingService.ts
//
// SPRINT 1A — v2.0: suporta cálculo sem persistência (Shadow/Legacy).
// computeXP() = calcula resultado puro, sem tocar no Firestore.
// persist() = grava de fato — só chamado em modo ENGINE.
// ============================================

import * as admin from 'firebase-admin';
import { RankingRepository } from '../repositories/RankingRepository';

const db = admin.firestore();

const SOCIAL_RANKING_CATEGORIES = ['SOCIAL', 'MISSION', 'CHAT'];

const LEAGUES = [
  { name: 'Galáxia',     minXP: 5000 },
  { name: 'Constelação', minXP: 2000 },
  { name: 'Ouro',        minXP: 1000 },
  { name: 'Prata',       minXP: 500  },
  { name: 'Bronze',      minXP: 0    },
];

function getLeague(xp: number): string {
  for (const league of LEAGUES) {
    if (xp >= league.minXP) return league.name;
  }
  return 'Bronze';
}

function getCurrentWeekId(): string {
  const now  = new Date();
  const year = now.getFullYear();
  const week = Math.ceil((now.getDate() - now.getDay() + 1) / 7);
  return `${year}_W${String(week).padStart(2, '0')}`;
}

function getCurrentSeasonId(): string {
  const now = new Date();
  return `S${now.getFullYear()}_${Math.ceil(now.getMonth() / 3)}`;
}

const EVENT_TO_RANKING_CATEGORY: Record<string, string> = {
  PROFILE_LIKE:      'SOCIAL',
  MATCH_CREATED:     'SOCIAL',
  MESSAGE_REPLY:     'CHAT',
  MISSION_COMPLETED: 'MISSION',
};

export interface RankingComputation {
  skipped:    boolean;
  reason?:    string;
  uid:        string;
  weekId:     string;
  seasonId:   string;
  category?:  string;
  isSocial?:  boolean;
  xpAmount?:  number;
  newSocialXP?: number;
  league?:    string;
}

export const RankingService = {

  getCategoryForEvent(eventType: string): string | undefined {
    return EVENT_TO_RANKING_CATEGORY[eventType];
  },

  // Calcula o resultado sem persistir — usado em LEGACY e SHADOW
  async computeXP(uid: string, eventType: string, xpAmount: number): Promise<RankingComputation> {
    const weekId   = getCurrentWeekId();
    const seasonId = getCurrentSeasonId();
    const category = EVENT_TO_RANKING_CATEGORY[eventType];

    if (!category || xpAmount <= 0) {
      return { skipped: true, reason: `Sem categoria de ranking para ${eventType}`, uid, weekId, seasonId };
    }

    const isSocial = SOCIAL_RANKING_CATEGORIES.includes(category);
    const rankDoc  = await db.collection('weeklyRanking').doc(`${uid}_${weekId}`).get();
    const current  = rankDoc.data()?.socialXP ?? 0;

    if (rankDoc.data()?.frozen) {
      return { skipped: true, reason: 'Ranking congelado', uid, weekId, seasonId };
    }

    const newSocialXP = current + (isSocial ? xpAmount : 0);

    return {
      skipped: false, uid, weekId, seasonId, category, isSocial,
      xpAmount, newSocialXP, league: getLeague(newSocialXP),
    };
  },

  // Persiste de fato — só deve ser chamado em modo ENGINE
  async persist(computation: RankingComputation): Promise<void> {
    if (computation.skipped) return;

    const { uid, weekId, seasonId, isSocial, xpAmount, league } = computation;

    await db.runTransaction(async (t) => {
      const [snapshot, userDoc] = await Promise.all([
        RankingRepository.getSnapshot(t, uid, weekId),
        t.get(db.collection('users').doc(uid)),
      ]);

      if (snapshot.frozen) return; // re-checa dentro da transaction

      const userData = userDoc.data() ?? {};

      RankingRepository.write(t, uid, weekId, {
        uid, weekId, seasonId: seasonId!,
        weeklyXP:    xpAmount!,
        lifetimeXP:  xpAmount!,
        league:      league!,
        displayName: userData.name     ?? 'Usuário',
        photoURL:    userData.photoURL ?? '',
        socialXP:    isSocial ? xpAmount : undefined,
        firstXPAt:   isSocial && !snapshot.firstXPAt,
      });

      RankingRepository.writeUserRankingFields(t, uid, xpAmount!, xpAmount!, xpAmount!);
    });
  },
};
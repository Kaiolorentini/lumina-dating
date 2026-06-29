// ============================================
// LUMINA — DESAFIO SEMANAL v5.1
// functions/src/premium/weeklyChallengeService.ts
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as scheduler  from 'firebase-functions/v2/scheduler';
import * as admin      from 'firebase-admin';
import { FieldValue }  from 'firebase-admin/firestore';
import { PREMIUM_FLAGS } from './config/premiumFlags';

const db = admin.firestore();

const WEEKLY_CHALLENGES = [
  { type: 'sintonias_5',   label: 'Crie 5 Sintonias esta semana',        fragments: 80,  xp: 50,  badge: null           },
  { type: 'missoes_21',    label: 'Complete 21 missões esta semana',      fragments: 60,  xp: 40,  badge: null           },
  { type: 'visitas_50',    label: 'Visite 50 perfis esta semana',         fragments: 50,  xp: 30,  badge: null           },
  { type: 'conversas_3',   label: 'Inicie 3 conversas reais esta semana', fragments: 70,  xp: 45,  badge: null           },
  { type: 'streak_7',      label: 'Mantenha sequência por 7 dias',        fragments: 100, xp: 60,  badge: 'badge_semana' },
  { type: 'faisca_7',      label: 'Resgate Faísca por 7 dias seguidos',   fragments: 60,  xp: 35,  badge: null           },
  { type: 'ranking_top10', label: 'Entre no Top 10 do Ranking Social',    fragments: 120, xp: 80,  badge: 'badge_elite'  },
  { type: 'vault_3',       label: 'Faça 3 saques do Cofre esta semana',   fragments: 50,  xp: 30,  badge: null           },
];

const BONUS_CHALLENGES = [
  { type: 'bonus_sintonias_10', label: 'Crie 10 Sintonias esta semana',   fragments: 150, xp: 100, badge: 'badge_conector' },
  { type: 'bonus_top5',        label: 'Entre no Top 5 do Ranking Social', fragments: 200, xp: 120, badge: 'badge_elite_5'  },
  { type: 'bonus_arvore',      label: 'Ganhe 50 XP de Árvore esta semana',fragments: 100, xp: 60,  badge: null             },
];

function getWeekId(): string {
  const now  = new Date();
  const year = now.getFullYear();
  const week = Math.ceil((now.getDate() - now.getDay() + 1) / 7);
  return `${year}_W${String(week).padStart(2, '0')}`;
}

function sortearDesafio(uid: string, weekId: string, catalog: typeof WEEKLY_CHALLENGES): typeof WEEKLY_CHALLENGES[number] {
  const seed = uid.slice(0, 8) + weekId.replace(/_/g, '');
  const hash = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return catalog[hash % catalog.length];
}

export const getWeeklyChallenge = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    if (!PREMIUM_FLAGS.PREMIUM_WEEKLY_CHALLENGE_ENABLED) {
      throw new functions.HttpsError('unavailable', 'Desafio Semanal indisponível.');
    }

    const weekId    = getWeekId();
    const docId     = `${uid}_${weekId}`;
    const chalRef   = db.collection('weeklyChallenges').doc(docId);
    const walletDoc = await db.collection('wallets').doc(uid).get();
    const isPremium = (walletDoc.data()?.galaxiaPlus?.ativo === true) ||
                      (walletDoc.data()?.coinsPremium ?? 0) > 0;

    const existing = await chalRef.get();
    if (existing.exists) {
      return { ...existing.data(), weekId, isPremium };
    }

    const mainChallenge  = sortearDesafio(uid, weekId, WEEKLY_CHALLENGES);
    const bonusChallenge = isPremium
      ? sortearDesafio(uid, weekId + '_bonus', BONUS_CHALLENGES)
      : null;

    const data = {
      uid,
      weekId,
      main:  { ...mainChallenge,  progress: 0, completed: false, claimed: false },
      bonus: bonusChallenge
        ? { ...bonusChallenge, progress: 0, completed: false, claimed: false }
        : null,
      isPremium,
      generatedAt: FieldValue.serverTimestamp(),
    };

    await chalRef.set(data);
    return { ...data, weekId };
  }
);

export const progressWeeklyChallenge = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { challengeType, amount = 1 } = request.data as {
      challengeType: string;
      amount?:       number;
    };

    const weekId    = getWeekId();
    const docId     = `${uid}_${weekId}`;
    const chalRef   = db.collection('weeklyChallenges').doc(docId);
    const walletRef = db.collection('wallets').doc(uid);
    const ledgerRef = db.collection('economyLedger');

    const result = await db.runTransaction(async (t) => {
      const [chalDoc, walletDoc] = await Promise.all([t.get(chalRef), t.get(walletRef)]);

      if (!chalDoc.exists) {
        throw new functions.HttpsError('not-found', 'Desafio semanal não encontrado.');
      }

      const chalData = chalDoc.data()!;
      const wallet   = walletDoc.data() ?? {};
      const earned   = { fragments: 0, xp: 0, badge: null as string | null };

      if (chalData.main?.type === challengeType && !chalData.main.completed) {
        const newProgress = Math.min((chalData.main.progress ?? 0) + amount, chalData.main.target ?? 1);
        const completed   = newProgress >= (chalData.main.target ?? 1);
        t.set(chalRef, { main: { ...chalData.main, progress: newProgress, completed, claimed: completed } }, { merge: true });
        if (completed) {
          earned.fragments += chalData.main.fragments ?? 0;
          earned.xp        += chalData.main.xp        ?? 0;
          earned.badge      = chalData.main.badge      ?? null;
        }
      }

      if (chalData.bonus?.type === challengeType && !chalData.bonus.completed) {
        const newProgress = Math.min((chalData.bonus.progress ?? 0) + amount, chalData.bonus.target ?? 1);
        const completed   = newProgress >= (chalData.bonus.target ?? 1);
        t.set(chalRef, { bonus: { ...chalData.bonus, progress: newProgress, completed, claimed: completed } }, { merge: true });
        if (completed) {
          earned.fragments += chalData.bonus.fragments ?? 0;
          earned.xp        += chalData.bonus.xp        ?? 0;
          if (chalData.bonus.badge) earned.badge = chalData.bonus.badge;
        }
      }

      if (earned.fragments > 0) {
        const prevFrags = wallet.fragments ?? 0;
        t.set(walletRef, { fragments: FieldValue.increment(earned.fragments), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        t.set(ledgerRef.doc(), {
          uid, tipo: 'WEEKLY_CHALLENGE_REWARD', weekId, challengeType,
          fragmentos: earned.fragments, saldoAntes: prevFrags,
          saldoDepois: prevFrags + earned.fragments,
          timestamp: FieldValue.serverTimestamp(), imutavel: true,
        });
      }

      if (earned.badge) {
        t.set(db.collection('users').doc(uid), {
          [`progression.unlockedItems.badge_${earned.badge}`]: true,
        }, { merge: true });
      }

      return earned;
    });

    return { success: true, ...result };
  }
);

export const resetWeeklyChallenges = scheduler.onSchedule(
  { schedule: 'every monday 00:15', region: 'us-central1' },
  async () => {
    console.log('[resetWeeklyChallenges] Nova semana iniciada');
    await db.collection('weeklyMeta').doc(getWeekId()).set({
      weekId:    getWeekId(),
      startedAt: FieldValue.serverTimestamp(),
    });
  }
);
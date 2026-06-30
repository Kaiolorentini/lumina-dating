// ============================================
// LUMINA — EARN XP (ANTI-FARM) v6.0
// functions/src/economy/earnXP.ts
//
// SPRINT 1C — v6.0: usa LegacyShadowOrchestrator.
// Adapters são comparadores puros — nunca tocam o Engine real,
// nunca criam GameEvents, nunca persistem nada.
// Resposta ao cliente 100% inalterada.
// ============================================

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { XP_REWARDS, DAILY_LIMITS, XP_LEVELS } from '../config/economy';
import { LegacyShadowOrchestrator } from '../gamification/compatibility/LegacyShadowOrchestrator';
import { CompareParams } from '../gamification/compatibility/ICompatibilityAdapter';

export type XPAction =
  | 'VISIT_PROFILE'
  | 'GIVE_LIKE'
  | 'RECEIVE_LIKE'
  | 'START_CONVERSATION'
  | 'CREATE_SINTONIA'
  | 'COMPLETE_MISSION'
  | 'UNLOCK_ACHIEVEMENT';

interface EarnXPRequest {
  action:     XPAction;
  targetUid?: string;
}

function newEventId(): string {
  return `earnxp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const earnXP = onCall(
  { maxInstances: 10, region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const { action, targetUid } = request.data as EarnXPRequest;
    if (!action) throw new HttpsError('invalid-argument', 'Action inválida.');

    const db      = admin.firestore();
    const userRef = db.collection('users').doc(uid);

    try {
      const result = await db.runTransaction(async (t) => {
        const userSnap = await t.get(userRef);
        if (!userSnap.exists) {
          throw new HttpsError('not-found', 'Usuário não encontrado.');
        }

        const userData = userSnap.data()!;
        const daily    = userData.daily       ?? {};
        const prog     = userData.progression ?? {};

        if ((userData.trustScore ?? 0) < 30) {
          return { skipped: true, reason: 'trust_score_too_low' };
        }

        let xpAmount = 0;
        const updates: Record<string, unknown> = {};

        switch (action) {
          case 'VISIT_PROFILE': {
            if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid obrigatório.');
            const visited: string[] = daily.profilesVisitedForXP ?? [];
            if (visited.includes(targetUid)) return { skipped: true, reason: 'already_visited_today' };
            xpAmount = XP_REWARDS.VISIT_PROFILE;
            updates['daily.profilesVisitedForXP'] = admin.firestore.FieldValue.arrayUnion(targetUid);
            break;
          }
          case 'GIVE_LIKE': {
            if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid obrigatório.');
            const liked: string[] = daily.likedProfiles ?? [];
            if (liked.includes(targetUid)) return { skipped: true, reason: 'already_liked_today' };
            xpAmount = XP_REWARDS.GIVE_LIKE;
            updates['daily.likedProfiles'] = admin.firestore.FieldValue.arrayUnion(targetUid);
            break;
          }
          case 'RECEIVE_LIKE': {
            if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid obrigatório.');
            const likesFrom: string[] = daily.likesReceivedFrom ?? [];
            if (likesFrom.includes(targetUid)) return { skipped: true, reason: 'already_counted' };
            const xpFromLikesToday = daily.xpFromLikesToday ?? 0;
            if (xpFromLikesToday >= DAILY_LIMITS.XP_FROM_LIKES_MAX) {
              return { skipped: true, reason: 'daily_like_xp_cap_reached' };
            }
            xpAmount = Math.min(XP_REWARDS.RECEIVE_LIKE, DAILY_LIMITS.XP_FROM_LIKES_MAX - xpFromLikesToday);
            updates['daily.likesReceivedFrom'] = admin.firestore.FieldValue.arrayUnion(targetUid);
            updates['daily.xpFromLikesToday']  = admin.firestore.FieldValue.increment(xpAmount);
            break;
          }
          case 'START_CONVERSATION': {
            if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid obrigatório.');
            const convs: string[] = daily.conversationsStartedXP ?? [];
            if (convs.includes(targetUid)) return { skipped: true, reason: 'already_counted' };
            xpAmount = XP_REWARDS.START_CONVERSATION;
            updates['daily.conversationsStartedXP'] = admin.firestore.FieldValue.arrayUnion(targetUid);
            break;
          }
          case 'CREATE_SINTONIA': {
            if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid obrigatório.');
            const sintonias: string[] = daily.sintoniaXPGranted ?? [];
            if (sintonias.includes(targetUid)) return { skipped: true, reason: 'already_counted' };
            xpAmount = XP_REWARDS.CREATE_SINTONIA;
            updates['daily.sintoniaXPGranted'] = admin.firestore.FieldValue.arrayUnion(targetUid);
            break;
          }
          case 'COMPLETE_MISSION': {
            xpAmount = XP_REWARDS.COMPLETE_MISSION;
            break;
          }
          case 'UNLOCK_ACHIEVEMENT': {
            xpAmount = XP_REWARDS.UNLOCK_ACHIEVEMENT;
            break;
          }
        }

        if (xpAmount <= 0) return { skipped: true, reason: 'zero_xp' };

        const prevXP    = prog.xp    ?? 0;
        const prevLevel = prog.level ?? 1;
        const prevTier  = prog.profileTier ?? 'comum';
        const newXP     = prevXP + xpAmount;
        const newLevel  = calculateLevel(newXP);
        const newTier   = calculateTier(newXP);

        t.update(userRef, {
          ...updates,
          'progression.xp':         newXP,
          'progression.level':       newLevel,
          'progression.profileTier': newTier,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const logRef = db.collection('xpAuditLogs').doc();
        t.set(logRef, {
          uid, action,
          targetUid:     targetUid ?? null,
          xpAmount,
          xpAnterior:    prevXP,
          xpPosterior:   newXP,
          levelAnterior: prevLevel,
          levelPosterior: newLevel,
          tierAnterior:  prevTier,
          tierPosterior: newTier,
          createdAt:     admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, xpAmount, newXP, newLevel, newTier, leveledUp: newLevel > prevLevel, tierUp: newTier !== prevTier };
      });

      // SPRINT 1C — v6.0: dispara comparação Shadow via Orchestrator.
      // 100% fire-and-forget. Adapters são comparadores puros —
      // nunca tocam o Engine real, nunca persistem nada.
      if ('success' in result && result.success) {
        const eventId = newEventId();

        const xpParams: CompareParams = {
          uid, eventId, legacyActionKey: action,
          legacyResult: { xpAmount: result.xpAmount, newXP: result.newXP, newLevel: result.newLevel },
          calculatorInput: {
            actionKey: action,
            currentTotalXP: result.newXP - result.xpAmount,
            currentXPToday: 0, // aproximação — Shadow não precisa de precisão perfeita no estado diário
            fertilizerActive: false,
          },
        };

        LegacyShadowOrchestrator
          .dispatchComparisons(action, { XP: xpParams })
          .catch(() => { /* nunca afeta a resposta ao cliente */ });
      }

      return result;
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      console.error('[earnXP] Erro:', error);
      throw new HttpsError('internal', 'Erro ao creditar XP.');
    }
  }
);

function calculateLevel(xp: number): number {
  const sorted = [...XP_LEVELS].sort((a, b) => b.xpRequired - a.xpRequired);
  for (const l of sorted) {
    if (xp >= l.xpRequired) return l.level;
  }
  return 1;
}

function calculateTier(xp: number): string {
  const sorted = [...XP_LEVELS].sort((a, b) => b.xpRequired - a.xpRequired);
  for (const l of sorted) {
    if (xp >= l.xpRequired) return l.tier;
  }
  return 'comum';
}
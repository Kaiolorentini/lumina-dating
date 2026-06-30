// ============================================
// LUMINA — ACHIEVEMENTS SYSTEM v5.2
// functions/src/engagement/achievements.ts
//
// SPRINT 1C: checkAchievements agora dispara
// LegacyShadowOrchestrator com legacyResult real.
// Resposta ao cliente 100% inalterada.
// getAchievementsStatus e repairAchievements: INALTERADAS.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as scheduler from 'firebase-functions/v2/scheduler';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ACHIEVEMENTS_CATALOG, ACHIEVEMENTS_BY_ACTION } from '../config/achievementsCatalog';
import { COLLECTIONS_CATALOG } from '../config/collectionsCatalog';
import { LegacyShadowOrchestrator } from '../gamification/compatibility/LegacyShadowOrchestrator';
import { CompareParams } from '../gamification/compatibility/ICompatibilityAdapter';

const db = admin.firestore();

function newEventId(): string {
  return `ach_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Verifica e desbloqueia conquistas por ação ──
export const checkAchievements = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const { action, currentValue } = request.data as { action: string; currentValue: number };

    const relatedIds = ACHIEVEMENTS_BY_ACTION[action] ?? [];
    if (relatedIds.length === 0) return { unlocked: [] };

    const userRef   = db.collection('users').doc(uid);
    const achLogRef = db.collection('achievementLog');
    const notifRef  = db.collection('notifications');

    const userDoc  = await userRef.get();
    const userData = userDoc.data() ?? {};

    // SPRINT 1C: captura estado PRÉ-ação para o Calculator
    const preUnlocked: string[]              = userData.achievements?.unlocked  ?? [];
    const preProgress: Record<string, number> = userData.achievements?.progress  ?? {};

    const unlocked: string[]              = [...preUnlocked];
    const progress: Record<string, number> = { ...preProgress };

    const newlyUnlocked: string[] = [];

    for (const achId of relatedIds) {
      const ach = ACHIEVEMENTS_CATALOG[achId];
      if (!ach) continue;
      if (unlocked.includes(achId)) continue;

      const currentProgress = Math.max(progress[achId] ?? 0, currentValue);

      await db.runTransaction(async (t) => {
        const freshDoc  = await t.get(userRef);
        const freshData = freshDoc.data() ?? {};
        const freshUnlocked: string[] = freshData.achievements?.unlocked ?? [];
        if (freshUnlocked.includes(achId)) return;

        t.set(userRef, { achievements: { progress: { [achId]: currentProgress } } }, { merge: true });

        if (currentProgress < ach.target) return;

        t.set(userRef, {
          achievements: { unlocked: FieldValue.arrayUnion(achId), unlockedAt: { [achId]: FieldValue.serverTimestamp() } },
        }, { merge: true });

        t.set(achLogRef.doc(), {
          uid, achievementId: achId, title: ach.title, category: ach.category,
          rarity: ach.rarity, version: ach.version, source: action,
          xpReward: ach.reward.xp, timestamp: FieldValue.serverTimestamp(), imutavel: true,
        });

        t.set(notifRef.doc(), {
          userId: uid, type: 'achievement_unlocked',
          title: `${ach.icon} ${ach.title}`, message: ach.description,
          icon: ach.icon, read: false,
          dados: { achievementId: achId, rarity: ach.rarity, reward: ach.reward },
          timestamp: FieldValue.serverTimestamp(),
        });

        if (ach.reward.fragments > 0) {
          const walletRef = db.collection('wallets').doc(uid);
          const walletDoc = await t.get(walletRef);
          const wallet    = walletDoc.data() ?? {};
          t.set(walletRef, { fragments: FieldValue.increment(ach.reward.fragments), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          t.set(db.collection('economyLedger').doc(), {
            uid, tipo: 'ACHIEVEMENT_REWARD', achievementId: achId,
            fragmentos: ach.reward.fragments, saldoAntes: wallet.fragments ?? 0,
            saldoDepois: (wallet.fragments ?? 0) + ach.reward.fragments,
            timestamp: FieldValue.serverTimestamp(), imutavel: true,
          });
        }

        if (ach.reward.badge) t.set(userRef, { [`progression.unlockedItems.badge_${ach.reward.badge}`]: true }, { merge: true });
        if (ach.reward.frame) t.set(userRef, { [`progression.unlockedItems.frame_${ach.reward.frame}`]: true }, { merge: true });
        if (ach.reward.title) t.set(userRef, { [`progression.availableTitles`]: FieldValue.arrayUnion(ach.reward.title) }, { merge: true });

        newlyUnlocked.push(achId);

        t.set(db.collection('achievementAnalytics').doc(), {
          uid, achievementId: achId, category: ach.category,
          rarity: ach.rarity, timestamp: FieldValue.serverTimestamp(),
        });
      });

      if (newlyUnlocked.includes(achId)) {
        await checkCollections(uid, [...unlocked, ...newlyUnlocked]);
      }
    }

    // SPRINT 1C: dispara comparação Shadow — fire-and-forget
    if (relatedIds.length > 0) {
      const eventId = newEventId();
      const params: CompareParams = {
        uid, eventId, legacyActionKey: action,
        legacyResult: { unlockedIds: newlyUnlocked },
        calculatorInput: {
          actionKey:        action,
          currentUnlocked:  preUnlocked,
          currentProgress:  preProgress,
        },
      };

      LegacyShadowOrchestrator
        .dispatchComparisons(action, { ACHIEVEMENT: params })
        .catch(() => { /* nunca afeta a resposta ao cliente */ });
    }

    return { unlocked: newlyUnlocked };
  }
);

// ── Verifica e completa coleções ──
async function checkCollections(uid: string, unlockedAchievements: string[]): Promise<void> {
  const userRef  = db.collection('users').doc(uid);
  const notifRef = db.collection('notifications');

  const userDoc  = await userRef.get();
  const userData = userDoc.data() ?? {};
  const completedCollections: string[] = userData.achievements?.completedCollections ?? [];

  for (const [colId, col] of Object.entries(COLLECTIONS_CATALOG)) {
    if (completedCollections.includes(colId)) continue;

    const allDone = col.achievementIds.every(id => unlockedAchievements.includes(id));
    if (!allDone) continue;

    await db.runTransaction(async (t) => {
      const freshDoc  = await t.get(userRef);
      const freshData = freshDoc.data() ?? {};
      const freshCompleted: string[] = freshData.achievements?.completedCollections ?? [];
      if (freshCompleted.includes(colId)) return;

      t.set(userRef, {
        achievements: {
          completedCollections:   FieldValue.arrayUnion(colId),
          collectionCompletedAt:  { [colId]: FieldValue.serverTimestamp() },
        },
      }, { merge: true });

      if (col.reward.fragments > 0) {
        const walletRef = db.collection('wallets').doc(uid);
        const walletDoc = await t.get(walletRef);
        const wallet    = walletDoc.data() ?? {};
        t.set(walletRef, { fragments: FieldValue.increment(col.reward.fragments), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        t.set(db.collection('economyLedger').doc(), {
          uid, tipo: 'COLLECTION_REWARD', collectionId: colId, tier: col.tier,
          fragmentos: col.reward.fragments, saldoAntes: wallet.fragments ?? 0,
          saldoDepois: (wallet.fragments ?? 0) + col.reward.fragments,
          timestamp: FieldValue.serverTimestamp(), imutavel: true,
        });
      }

      if (col.reward.badge) {
        t.set(userRef, { [`progression.unlockedItems.badge_${col.reward.badge}`]: true }, { merge: true });
      }

      t.set(notifRef.doc(), {
        userId: uid, type: 'collection_complete',
        title: `${col.icon} ${col.title} completa!`,
        message: `+${col.reward.fragments} Fragmentos${col.reward.badge ? ' + Badge exclusivo!' : '!'}`,
        icon: col.icon, read: false,
        dados: { collectionId: colId, tier: col.tier, reward: col.reward },
        timestamp: FieldValue.serverTimestamp(),
      });
    });
  }
}

// ── Status de conquistas — INALTERADA ──
export const getAchievementsStatus = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    const userDoc  = await db.collection('users').doc(uid).get();
    const userData = userDoc.data() ?? {};
    const achData  = userData.achievements ?? {};

    const unlocked:   string[]               = achData.unlocked            ?? [];
    const progress:   Record<string, number>  = achData.progress            ?? {};
    const completed:  string[]               = achData.completedCollections ?? [];
    const unlockedAt: Record<string, string>  = achData.unlockedAt          ?? {};

    const achievements = Object.values(ACHIEVEMENTS_CATALOG).map(ach => ({
      ...ach,
      unlocked:    unlocked.includes(ach.id),
      progress:    progress[ach.id] ?? 0,
      unlockedAt:  unlockedAt[ach.id] ?? null,
      title:       (!ach.hidden || unlocked.includes(ach.id)) ? ach.title       : '?????',
      description: (!ach.hidden || unlocked.includes(ach.id)) ? ach.description : 'Conquista secreta',
    }));

    const collections = Object.values(COLLECTIONS_CATALOG).map(col => ({
      ...col,
      completed:   completed.includes(col.id),
      achProgress: col.achievementIds.filter(id => unlocked.includes(id)).length,
      achTotal:    col.achievementIds.length,
    }));

    return {
      achievements, collections,
      totalUnlocked:   unlocked.length,
      totalAvailable:  Object.keys(ACHIEVEMENTS_CATALOG).length,
    };
  }
);

// ── repairAchievements — INALTERADA ──
export const repairAchievements = scheduler.onSchedule(
  { schedule: 'every 24 hours', region: 'us-central1' },
  async () => {
    const now       = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const usersSnap = await db.collection('users')
      .where('lastActive', '>=', yesterday)
      .limit(100)
      .get();

    console.log(`[repairAchievements] Verificando ${usersSnap.size} usuários`);
  }
);
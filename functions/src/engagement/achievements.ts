// ============================================
// LUMINA — ACHIEVEMENTS SYSTEM v5.3
// functions/src/engagement/achievements.ts
//
// v5.3: corrige bug de currentValue não incrementar.
// Actions incrementais (visit, mission, chat, sintonia, vault)
// acumulam progress[achId] + 1 no servidor.
// Actions absolutas (streak, tree) usam currentValue direto.
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

// Actions que usam currentValue absoluto (não acumulam +1)
const ABSOLUTE_ACTIONS = new Set([
  'STREAK_UPDATE',   // currentValue = currentStreak real
  'TREE_EVOLUTION',  // currentValue = stage real
]);

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

    const preUnlocked: string[]               = userData.achievements?.unlocked  ?? [];
    const preProgress: Record<string, number>  = userData.achievements?.progress  ?? {};

    const unlocked: string[]               = [...preUnlocked];
    const newlyUnlocked: string[]          = [];

    // v5.3: determina se a action é incremental ou absoluta
    const isAbsolute = ABSOLUTE_ACTIONS.has(action);

    for (const achId of relatedIds) {
      const ach = ACHIEVEMENTS_CATALOG[achId];
      if (!ach) continue;
      if (unlocked.includes(achId)) continue;

      const didUnlock = await db.runTransaction(async (t) => {
        const freshDoc  = await t.get(userRef);
        const freshData = freshDoc.data() ?? {};
        const freshUnlocked: string[] = freshData.achievements?.unlocked ?? [];
        const freshProgress: Record<string, number> = freshData.achievements?.progress ?? {};

        if (freshUnlocked.includes(achId)) return false;

        // v5.3: recalcula com dados frescos da transação
        const freshCurrent = isAbsolute
          ? currentValue
          : (freshProgress[achId] ?? 0) + 1;

        t.set(userRef, {
          achievements: { progress: { [achId]: freshCurrent } },
        }, { merge: true });

        if (freshCurrent < ach.target) return false;

        t.set(userRef, {
          achievements: {
            unlocked:   FieldValue.arrayUnion(achId),
            unlockedAt: { [achId]: FieldValue.serverTimestamp() },
          },
        }, { merge: true });

        t.set(achLogRef.doc(), {
          uid, achievementId: achId, title: ach.title, category: ach.category,
          rarity: ach.rarity, version: ach.version, source: action,
          xpReward: ach.reward.xp, timestamp: FieldValue.serverTimestamp(), imutavel: true,
        });

        t.set(notifRef.doc(), {
          userId: uid, type: 'achievement_unlocked',
          title:   `${ach.icon} ${ach.title}`,
          message: ach.description,
          icon:    ach.icon, read: false,
          dados:   { achievementId: achId, rarity: ach.rarity, reward: ach.reward },
          timestamp: FieldValue.serverTimestamp(),
        });

        if (ach.reward.fragments > 0) {
          const walletRef = db.collection('wallets').doc(uid);
          const walletDoc = await t.get(walletRef);
          const wallet    = walletDoc.data() ?? {};
          t.set(walletRef, {
            fragments:  FieldValue.increment(ach.reward.fragments),
            updatedAt:  FieldValue.serverTimestamp(),
          }, { merge: true });
          t.set(db.collection('economyLedger').doc(), {
            uid, tipo: 'ACHIEVEMENT_REWARD', achievementId: achId,
            fragmentos: ach.reward.fragments,
            saldoAntes: wallet.fragments ?? 0,
            saldoDepois: (wallet.fragments ?? 0) + ach.reward.fragments,
            timestamp: FieldValue.serverTimestamp(), imutavel: true,
          });
        }

   // Objeto aninhado (set com string contendo ponto cria campo literal)
        // Catálogo já traz o prefixo — não duplicar 'badge_'/'frame_'
        if (ach.reward.badge) {
          t.set(userRef, {
            progression: { unlockedItems: { [ach.reward.badge]: true } },
          }, { merge: true });
        }
        if (ach.reward.frame) {
          t.set(userRef, {
            progression: { unlockedItems: { [ach.reward.frame]: true } },
          }, { merge: true });
        }
        if (ach.reward.title) {
          t.set(userRef, {
            progression: { availableTitles: FieldValue.arrayUnion(ach.reward.title) },
          }, { merge: true });
        }

        t.set(db.collection('achievementAnalytics').doc(), {
          uid, achievementId: achId, category: ach.category,
          rarity: ach.rarity, timestamp: FieldValue.serverTimestamp(),
        });

        // Sinaliza pelo RETORNO da transaction, não por efeito
        // colateral: o Firestore pode reexecutar o callback em caso
        // de contenção, e um push() aqui duplicaria o id na lista
        // devolvida ao app.
        return true;
      });

      if (didUnlock === true) {
        newlyUnlocked.push(achId);
        await checkCollections(uid, [...unlocked, ...newlyUnlocked]);
      }
    }

    // Shadow — fire-and-forget
    if (relatedIds.length > 0) {
      const eventId = newEventId();
      const params: CompareParams = {
        uid, eventId, legacyActionKey: action,
        legacyResult: { unlockedIds: newlyUnlocked },
        calculatorInput: {
          actionKey:       action,
          currentUnlocked: preUnlocked,
          currentProgress: preProgress,
        },
      };
      LegacyShadowOrchestrator
        .dispatchComparisons(action, { ACHIEVEMENT: params })
        .catch(() => {});
    }

    return { unlocked: newlyUnlocked };
  }
);

// ── Verifica e completa coleções ── (inalterada)
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
          completedCollections:  FieldValue.arrayUnion(colId),
          collectionCompletedAt: { [colId]: FieldValue.serverTimestamp() },
        },
      }, { merge: true });

      if (col.reward.fragments > 0) {
        const walletRef = db.collection('wallets').doc(uid);
        const walletDoc = await t.get(walletRef);
        const wallet    = walletDoc.data() ?? {};
        t.set(walletRef, {
          fragments: FieldValue.increment(col.reward.fragments),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        t.set(db.collection('economyLedger').doc(), {
          uid, tipo: 'COLLECTION_REWARD', collectionId: colId, tier: col.tier,
          fragmentos: col.reward.fragments,
          saldoAntes: wallet.fragments ?? 0,
          saldoDepois: (wallet.fragments ?? 0) + col.reward.fragments,
          timestamp: FieldValue.serverTimestamp(), imutavel: true,
        });
      }

      if (col.reward.badge) {
        // Dois bugs num só: set() com string contendo ponto cria
        // campo LITERAL "progression.unlockedItems.badge_x" em vez de
        // aninhar, e o prefixo 'badge_' era duplicado — o catálogo
        // já traz ('badge_social_prata' virava 'badge_badge_social_prata').
        // O checkAchievements acima já fazia certo; aqui ficou para trás.
        t.set(userRef, {
          progression: { unlockedItems: { [col.reward.badge]: true } },
        }, { merge: true });
      }

      t.set(notifRef.doc(), {
        userId: uid, type: 'collection_complete',
        title:   `${col.icon} ${col.title} completa!`,
        message: `+${col.reward.fragments} Fragmentos${col.reward.badge ? ' + Badge exclusivo!' : '!'}`,
        icon:    col.icon, read: false,
        dados:   { collectionId: colId, tier: col.tier, reward: col.reward },
        timestamp: FieldValue.serverTimestamp(),
      });
    });
  }
}

// ── Status de conquistas ── (inalterada)
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
      totalUnlocked:  unlocked.length,
      totalAvailable: Object.keys(ACHIEVEMENTS_CATALOG).length,
    };
  }
);

// ── repairAchievements ── (inalterada)
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
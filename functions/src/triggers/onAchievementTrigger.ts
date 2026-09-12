// ============================================
// LUMINA — ACHIEVEMENT TRIGGER PROCESSOR v1.0
// functions/src/triggers/onAchievementTrigger.ts
//
// Processa documentos gravados em achievementTriggers/
// por CFs internas (MissionService, earnXP) que não
// podem chamar httpsCallable entre si.
//
// Fluxo:
//   CF interna grava em achievementTriggers/{docId}
//   → este trigger dispara
//   → chama checkAchievements internamente via Admin SDK
//   → marca processedAt para evitar reprocessamento
// ============================================

import * as firestore from 'firebase-functions/v2/firestore';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ACHIEVEMENTS_CATALOG, ACHIEVEMENTS_BY_ACTION } from '../config/achievementsCatalog';
import { COLLECTIONS_CATALOG } from '../config/collectionsCatalog';

const db = admin.firestore();

// Actions absolutas (usam currentValue direto, não +1)
const ABSOLUTE_ACTIONS = new Set(['STREAK_UPDATE', 'TREE_EVOLUTION']);

export const onAchievementTrigger = firestore.onDocumentCreated(
  'achievementTriggers/{docId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { uid, action, currentValue } = data as {
      uid:          string;
      action:       string;
      currentValue: number;
    };

    if (!uid || !action) return;

    const relatedIds = ACHIEVEMENTS_BY_ACTION[action] ?? [];
    if (relatedIds.length === 0) {
      // Marca como processado sem fazer nada
      await event.data?.ref.update({ processedAt: FieldValue.serverTimestamp() });
      return;
    }

    const isAbsolute  = ABSOLUTE_ACTIONS.has(action);
    const userRef     = db.collection('users').doc(uid);
    const achLogRef   = db.collection('achievementLog');
    const notifRef    = db.collection('notifications');

    const userDoc  = await userRef.get();
    const userData = userDoc.data() ?? {};
    const preUnlocked: string[] = userData.achievements?.unlocked ?? [];

    const newlyUnlocked: string[] = [];

    for (const achId of relatedIds) {
      const ach = ACHIEVEMENTS_CATALOG[achId];
      if (!ach) continue;
      if (preUnlocked.includes(achId)) continue;

      await db.runTransaction(async (t) => {
        const freshDoc  = await t.get(userRef);
        const freshData = freshDoc.data() ?? {};
        const freshUnlocked: string[] = freshData.achievements?.unlocked ?? [];
        const freshProgress: Record<string, number> = freshData.achievements?.progress ?? {};

        if (freshUnlocked.includes(achId)) return;

        const freshCurrent = isAbsolute
          ? currentValue
          : (freshProgress[achId] ?? 0) + 1;

        t.set(userRef, {
          achievements: { progress: { [achId]: freshCurrent } },
        }, { merge: true });

        if (freshCurrent < ach.target) return;

        t.set(userRef, {
          achievements: {
            unlocked:   FieldValue.arrayUnion(achId),
            unlockedAt: { [achId]: FieldValue.serverTimestamp() },
          },
        }, { merge: true });

        t.set(achLogRef.doc(), {
          uid, achievementId: achId, title: ach.title,
          category: ach.category, rarity: ach.rarity,
          version: ach.version, source: action,
          xpReward: ach.reward.xp,
          timestamp: FieldValue.serverTimestamp(), imutavel: true,
        });

        t.set(notifRef.doc(), {
          userId:  uid, type: 'achievement_unlocked',
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
            fragments: FieldValue.increment(ach.reward.fragments),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          t.set(db.collection('economyLedger').doc(), {
            uid, tipo: 'ACHIEVEMENT_REWARD', achievementId: achId,
            fragmentos:  ach.reward.fragments,
            saldoAntes:  wallet.fragments ?? 0,
            saldoDepois: (wallet.fragments ?? 0) + ach.reward.fragments,
            timestamp:   FieldValue.serverTimestamp(), imutavel: true,
          });
        }

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

        newlyUnlocked.push(achId);
      });
    }

    // Verifica coleções se desbloqueou algo
    if (newlyUnlocked.length > 0) {
      const freshUser = await userRef.get();
      const allUnlocked: string[] = freshUser.data()?.achievements?.unlocked ?? [];
      await checkCollections(uid, allUnlocked);
    }

    // Marca como processado
    await event.data?.ref.update({
      processedAt:  FieldValue.serverTimestamp(),
      newlyUnlocked,
    });
  }
);

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
          fragmentos:  col.reward.fragments,
          saldoAntes:  wallet.fragments ?? 0,
          saldoDepois: (wallet.fragments ?? 0) + col.reward.fragments,
          timestamp:   FieldValue.serverTimestamp(), imutavel: true,
        });
      }

      if (col.reward.badge) {
        // Campo literal + prefixo duplicado — o catálogo de coleções
        // já entrega 'badge_social_prata'. Virava 'badge_badge_social_prata'
        // numa chave fora de progression, e o app nunca via o badge.
        t.set(userRef, {
          progression: { unlockedItems: { [col.reward.badge]: true } },
        }, { merge: true });
      }

      t.set(notifRef.doc(), {
        userId:  uid, type: 'collection_complete',
        title:   `${col.icon} ${col.title} completa!`,
        message: `+${col.reward.fragments} Fragmentos${col.reward.badge ? ' + Badge exclusivo!' : '!'}`,
        icon:    col.icon, read: false,
        dados:   { collectionId: colId, tier: col.tier, reward: col.reward },
        timestamp: FieldValue.serverTimestamp(),
      });
    });
  }
}
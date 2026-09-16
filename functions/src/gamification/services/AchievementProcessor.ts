// ============================================
// LUMINA — ACHIEVEMENT PROCESSOR v1.0
// functions/src/gamification/services/AchievementProcessor.ts
//
// FASE 2G — núcleo único de conquistas e coleções.
//
// Antes existiam DUAS implementações idênticas: checkAchievements
// (onCall, para o cliente) e onAchievementTrigger (trigger, para
// CFs internas que não podem chamar httpsCallable). Toda correção
// precisava ser feita em dobro — e três já ficaram pela metade.
//
// As duas entradas continuam existindo (contratos diferentes),
// mas viram cascas finas sobre este núcleo.
//
// NÃO confundir com AchievementService.ts, que serve o Shadow Mode
// (computeUnlocks sem persistir) e segue intocado.
//
// Divergências resolvidas ao consolidar:
// - newlyUnlocked vem do RETORNO da transaction, nunca de push()
//   dentro dela: o Firestore reexecuta o callback em contenção e
//   o id era duplicado na lista.
// - checkCollections roda UMA vez no fim, com dados frescos do
//   Firestore — não dentro do loop com lista em memória.
// - Títulos de coleção passam a ser concedidos (col.reward.title
//   existe no catálogo e nenhuma das duas versões gravava).
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ACHIEVEMENTS_CATALOG, ACHIEVEMENTS_BY_ACTION } from '../../config/achievementsCatalog';
import { COLLECTIONS_CATALOG } from '../../config/collectionsCatalog';

const db = admin.firestore();

// Actions que usam currentValue absoluto (não acumulam +1).
// Sem isto, STREAK_30 (target 30) é inalcançável: o progresso
// somaria +1 por resgate em vez de receber o streak real.
const ABSOLUTE_ACTIONS = new Set([
  'STREAK_UPDATE',   // currentValue = daysStreak real
  'TREE_EVOLUTION',  // currentValue = stage real
]);

export const AchievementProcessor = {

  // Processa uma action e devolve os ids desbloqueados agora.
  async processAction(
    uid:          string,
    action:       string,
    currentValue: number
  ): Promise<string[]> {
    const relatedIds = ACHIEVEMENTS_BY_ACTION[action] ?? [];
    if (relatedIds.length === 0) return [];

    const isAbsolute = ABSOLUTE_ACTIONS.has(action);
    const userRef    = db.collection('users').doc(uid);

    const userDoc = await userRef.get();
    const preUnlocked: string[] = userDoc.data()?.achievements?.unlocked ?? [];

    const newlyUnlocked: string[] = [];

    for (const achId of relatedIds) {
      const ach = ACHIEVEMENTS_CATALOG[achId];
      if (!ach) continue;
      if (preUnlocked.includes(achId)) continue;

      const didUnlock = await db.runTransaction(async (t) => {
        const freshDoc  = await t.get(userRef);
        const freshData = freshDoc.data() ?? {};
        const freshUnlocked: string[] = freshData.achievements?.unlocked ?? [];
        const freshProgress: Record<string, number> = freshData.achievements?.progress ?? {};

        if (freshUnlocked.includes(achId)) return false;

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

        t.set(db.collection('achievementLog').doc(), {
          uid, achievementId: achId, title: ach.title, category: ach.category,
          rarity: ach.rarity, version: ach.version, source: action,
          xpReward: ach.reward.xp,
          timestamp: FieldValue.serverTimestamp(), imutavel: true,
        });

        t.set(db.collection('notifications').doc(), {
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

        // Objeto aninhado: set() com string contendo ponto cria
        // campo LITERAL em vez de aninhar. O catálogo já traz o
        // prefixo — não duplicar 'badge_'/'frame_'.
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

        return true;
      });

      if (didUnlock === true) newlyUnlocked.push(achId);
    }

    // Coleções: uma única passada no fim, com o estado real.
    if (newlyUnlocked.length > 0) {
      const freshUser = await userRef.get();
      const allUnlocked: string[] = freshUser.data()?.achievements?.unlocked ?? [];
      await this.checkCollections(uid, allUnlocked);
    }

    return newlyUnlocked;
  },

  async checkCollections(uid: string, unlockedAchievements: string[]): Promise<void> {
    const userRef  = db.collection('users').doc(uid);
    const userDoc  = await userRef.get();
    const completedCollections: string[] = userDoc.data()?.achievements?.completedCollections ?? [];

    for (const [colId, col] of Object.entries(COLLECTIONS_CATALOG)) {
      if (completedCollections.includes(colId)) continue;
      const allDone = col.achievementIds.every(id => unlockedAchievements.includes(id));
      if (!allDone) continue;

      await db.runTransaction(async (t) => {
        const freshDoc  = await t.get(userRef);
        const freshCompleted: string[] = freshDoc.data()?.achievements?.completedCollections ?? [];
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
          t.set(userRef, {
            progression: { unlockedItems: { [col.reward.badge]: true } },
          }, { merge: true });
        }

        // Títulos de coleção nunca eram concedidos — sete coleções
        // do catálogo definem title e nenhuma das duas versões
        // anteriores gravava o campo.
        if (col.reward.title) {
          t.set(userRef, {
            progression: { availableTitles: FieldValue.arrayUnion(col.reward.title) },
          }, { merge: true });
        }

        t.set(db.collection('notifications').doc(), {
          userId: uid, type: 'collection_complete',
          title:   `${col.icon} ${col.title} completa!`,
          message: `+${col.reward.fragments} Fragmentos${col.reward.badge ? ' + Badge exclusivo!' : '!'}`,
          icon:    col.icon, read: false,
          dados:   { collectionId: colId, tier: col.tier, reward: col.reward },
          timestamp: FieldValue.serverTimestamp(),
        });
      });
    }
  },
};
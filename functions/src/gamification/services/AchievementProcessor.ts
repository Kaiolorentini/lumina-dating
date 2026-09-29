// ============================================
// LUMINA — ACHIEVEMENT PROCESSOR v1.1
// functions/src/gamification/services/AchievementProcessor.ts
//
// FASE 2G — núcleo único de conquistas e coleções.
//
// v1.1 (28/09) — TRANSAÇÕES QUE NUNCA FECHAVAM:
// as duas transações gravavam o progresso e SÓ DEPOIS liam a
// carteira. O Firestore exige todas as leituras antes de qualquer
// escrita e recusa a transação inteira: toda conquista e coleção
// que paga fragmentos NUNCA desbloqueava — nem o progresso era
// salvo. Agora: lê o usuário, decide, lê a carteira SÓ se vai
// desbloquear com fragmentos, e só então grava tudo.
//
// E os fragmentos pagos passam a ser registrados na economia
// (FRAG_CONQUISTA / FRAG_COLECAO).
//
// NÃO confundir com AchievementService.ts (Shadow Mode).
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ACHIEVEMENTS_CATALOG, ACHIEVEMENTS_BY_ACTION } from '../../config/achievementsCatalog';
import { COLLECTIONS_CATALOG } from '../../config/collectionsCatalog';
import { PrestigeService }     from '../../engagement/prestigeService';
import { auditLogFinanceiro }  from '../../utils/auditLogFinanceiro';

const db = admin.firestore();

// Actions que usam currentValue absoluto (não acumulam +1).
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
    const walletRef  = db.collection('wallets').doc(uid);

    const userDoc = await userRef.get();
    const preUnlocked: string[] = userDoc.data()?.achievements?.unlocked ?? [];

    const newlyUnlocked: string[] = [];

    for (const achId of relatedIds) {
      const ach = ACHIEVEMENTS_CATALOG[achId];
      if (!ach) continue;
      if (preUnlocked.includes(achId)) continue;

      const didUnlock = await db.runTransaction(async (t) => {
        // ── 1. LEITURAS ──
        const freshDoc  = await t.get(userRef);
        const freshData = freshDoc.data() ?? {};
        const freshUnlocked: string[] = freshData.achievements?.unlocked ?? [];
        const freshProgress: Record<string, number> = freshData.achievements?.progress ?? {};

        if (freshUnlocked.includes(achId)) return false;

        const freshCurrent = isAbsolute
          ? currentValue
          : (freshProgress[achId] ?? 0) + 1;

        const unlocks = freshCurrent >= ach.target;
        const paysFragments = unlocks && ach.reward.fragments > 0;

        // A carteira só é lida quando vai pagar — sem custo extra nos
        // eventos que só avançam o progresso.
        const walletSnap = paysFragments ? await t.get(walletRef) : null;

        // ── 2. ESCRITAS ──
        t.set(userRef, {
          achievements: { progress: { [achId]: freshCurrent } },
        }, { merge: true });

        if (!unlocks) return false;

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

        if (paysFragments && walletSnap) {
          const before = (walletSnap.data()?.fragments as number) ?? 0;
          t.set(walletRef, {
            fragments: FieldValue.increment(ach.reward.fragments),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          t.set(db.collection('economyLedger').doc(), {
            uid, tipo: 'ACHIEVEMENT_REWARD', achievementId: achId,
            fragmentos:  ach.reward.fragments,
            saldoAntes:  before,
            saldoDepois: before + ach.reward.fragments,
            timestamp:   FieldValue.serverTimestamp(), imutavel: true,
          });
          auditLogFinanceiro({
            uid, tipo: 'FRAG_CONQUISTA', valor: ach.reward.fragments,
            origem: 'AchievementProcessor', metadata: { achievementId: achId },
          }, t);
        }

        // Objeto aninhado: set() com ponto no nome cria campo literal.
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

      if (didUnlock === true) {
        newlyUnlocked.push(achId);

        // Únicas conquistas que também valem prestígio.
        if (achId === 'STREAK_30') {
          PrestigeService.grantMarco(uid, 'ACH_STREAK_30').catch(() => {});
        }
        if (achId === 'FOUNDER_EARLY') {
          PrestigeService.grantMarco(uid, 'ACH_FOUNDER').catch(() => {});
        }
      }
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
    const userRef   = db.collection('users').doc(uid);
    const walletRef = db.collection('wallets').doc(uid);
    const userDoc   = await userRef.get();
    const completedCollections: string[] = userDoc.data()?.achievements?.completedCollections ?? [];

    for (const [colId, col] of Object.entries(COLLECTIONS_CATALOG)) {
      if (completedCollections.includes(colId)) continue;
      const allDone = col.achievementIds.every(id => unlockedAchievements.includes(id));
      if (!allDone) continue;

      await db.runTransaction(async (t) => {
        // ── 1. LEITURAS ──
        const freshDoc = await t.get(userRef);
        const freshCompleted: string[] = freshDoc.data()?.achievements?.completedCollections ?? [];
        if (freshCompleted.includes(colId)) return;

        const walletSnap = col.reward.fragments > 0 ? await t.get(walletRef) : null;

        // ── 2. ESCRITAS ──
        t.set(userRef, {
          achievements: {
            completedCollections:  FieldValue.arrayUnion(colId),
            collectionCompletedAt: { [colId]: FieldValue.serverTimestamp() },
          },
        }, { merge: true });

        if (walletSnap) {
          const before = (walletSnap.data()?.fragments as number) ?? 0;
          t.set(walletRef, {
            fragments: FieldValue.increment(col.reward.fragments),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          t.set(db.collection('economyLedger').doc(), {
            uid, tipo: 'COLLECTION_REWARD', collectionId: colId, tier: col.tier,
            fragmentos:  col.reward.fragments,
            saldoAntes:  before,
            saldoDepois: before + col.reward.fragments,
            timestamp:   FieldValue.serverTimestamp(), imutavel: true,
          });
          auditLogFinanceiro({
            uid, tipo: 'FRAG_COLECAO', valor: col.reward.fragments,
            origem: 'AchievementProcessor', metadata: { collectionId: colId, tier: col.tier },
          }, t);
        }

        if (col.reward.badge) {
          t.set(userRef, {
            progression: { unlockedItems: { [col.reward.badge]: true } },
          }, { merge: true });
        }

        if (col.reward.title) {
          t.set(userRef, {
            progression: { availableTitles: FieldValue.arrayUnion(col.reward.title) },
          }, { merge: true });
        }

        t.set(db.collection('notifications').doc(), {
          userId: uid, type: 'collection_complete',
          title:   `${col.icon} ${col.title} completa!`,
          message: col.reward.title
            ? `+${col.reward.fragments} Fragmentos + título ${col.reward.title}!`
            : `+${col.reward.fragments} Fragmentos!`,
          icon:    col.icon, read: false,
          dados:   { collectionId: colId, tier: col.tier, reward: col.reward },
          timestamp: FieldValue.serverTimestamp(),
        });
      });

      if (col.tier === 'GOLD') {
        await this.checkGoldCollectionMarcos(uid);
      }
    }
  },

  /** Marco de prestígio na 1ª e na 3ª coleção Ouro. */
  async checkGoldCollectionMarcos(uid: string): Promise<void> {
    const snap = await db.collection('users').doc(uid).get();
    const completed: string[] = snap.data()?.achievements?.completedCollections ?? [];

    const goldCount = completed.filter(
      (id) => COLLECTIONS_CATALOG[id]?.tier === 'GOLD',
    ).length;

    if (goldCount === 3) {
      await PrestigeService.grantMarco(uid, 'COLLECTION_GOLD_3');
    } else if (goldCount === 1) {
      await PrestigeService.grantMarco(uid, 'COLLECTION_GOLD_1');
    }
  },
};
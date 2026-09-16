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
import { ACHIEVEMENTS_CATALOG, ACHIEVEMENTS_BY_ACTION } from '../config/achievementsCatalog';
import { COLLECTIONS_CATALOG } from '../config/collectionsCatalog';
import { LegacyShadowOrchestrator } from '../gamification/compatibility/LegacyShadowOrchestrator';
import { CompareParams } from '../gamification/compatibility/ICompatibilityAdapter';
import { AchievementProcessor } from '../gamification/services/AchievementProcessor';

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

    // Estado anterior, capturado antes do processamento — o Shadow
    // compara contra ele.
    const userDoc  = await db.collection('users').doc(uid).get();
    const userData = userDoc.data() ?? {};
    const preUnlocked: string[]              = userData.achievements?.unlocked ?? [];
    const preProgress: Record<string, number> = userData.achievements?.progress ?? {};

    // FASE 2G: toda a lógica vive no AchievementProcessor. Esta CF
    // é apenas a porta de entrada do cliente; o onAchievementTrigger
    // é a porta das CFs internas. Ambas chamam o mesmo núcleo.
    const newlyUnlocked = await AchievementProcessor.processAction(uid, action, currentValue);

    // Shadow — fire-and-forget
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

    return { unlocked: newlyUnlocked };
  }
);



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
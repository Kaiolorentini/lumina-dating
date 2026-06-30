// ============================================
// LUMINA — ACHIEVEMENT SERVICE v1.0
// functions/src/gamification/services/AchievementService.ts
//
// SPRINT 1A — computeUnlocks() calcula sem persistir (LEGACY/SHADOW).
// persist() grava de fato — só chamado em modo ENGINE.
// ============================================

import * as admin from 'firebase-admin';
import { AchievementRepository } from '../repositories/AchievementRepository';
import { ACHIEVEMENTS_CATALOG, ACHIEVEMENTS_BY_ACTION } from '../../config/achievementsCatalog';

const db = admin.firestore();

const EVENT_TO_ACH_ACTION: Record<string, string> = {
  PROFILE_VISIT:     'VISIT_PROFILE',
  PROFILE_LIKE:      'GIVE_LIKE',
  MATCH_CREATED:     'CREATE_SINTONIA',
  MESSAGE_REPLY:     'START_CONVO',
  MISSION_COMPLETED: 'COMPLETE_MISSION',
};

export interface AchievementUnlockCandidate {
  achId:           string;
  title:           string;
  icon:            string;
  description:     string;
  category:        string;
  rarity:          string;
  newProgress:     number;
  willUnlock:      boolean;
}

export interface AchievementComputation {
  skipped:     boolean;
  reason?:     string;
  candidates:  AchievementUnlockCandidate[];
}

export const AchievementService = {

  getActionKey(eventType: string): string | undefined {
    return EVENT_TO_ACH_ACTION[eventType];
  },

  // Calcula quais conquistas avançariam/desbloqueariam — sem persistir
  async computeUnlocks(uid: string, eventType: string): Promise<AchievementComputation> {
    const actionKey  = EVENT_TO_ACH_ACTION[eventType];
    const relatedIds = actionKey ? (ACHIEVEMENTS_BY_ACTION[actionKey] ?? []) : [];

    if (relatedIds.length === 0) {
      return { skipped: true, reason: `Sem conquistas para ${eventType}`, candidates: [] };
    }

    const snapshot = await AchievementRepository.getSnapshot(uid);
    const candidates: AchievementUnlockCandidate[] = [];

    for (const achId of relatedIds) {
      const ach = ACHIEVEMENTS_CATALOG[achId];
      if (!ach || snapshot.unlocked.includes(achId)) continue;

      const newProgress = (snapshot.progress[achId] ?? 0) + 1;
      candidates.push({
        achId, title: ach.title, icon: ach.icon, description: ach.description,
        category: ach.category, rarity: ach.rarity,
        newProgress, willUnlock: newProgress >= ach.target,
      });
    }

    return { skipped: candidates.length === 0, candidates };
  },

  // Persiste de fato — só deve ser chamado em modo ENGINE
  async persist(uid: string, eventType: string, computation: AchievementComputation): Promise<string[]> {
    if (computation.skipped) return [];

    const newlyUnlocked: string[] = [];

    for (const candidate of computation.candidates) {
      await db.runTransaction(async (t) => {
        const fresh = await AchievementRepository.getSnapshotInTransaction(t, uid);
        if (fresh.unlocked.includes(candidate.achId)) return;

        AchievementRepository.updateProgress(t, uid, candidate.achId, candidate.newProgress);

        if (!candidate.willUnlock) return;

        AchievementRepository.unlock(t, uid, candidate.achId);
        AchievementRepository.writeLog(t, {
          uid, achievementId: candidate.achId, title: candidate.title,
          category: candidate.category, rarity: candidate.rarity, source: eventType,
        });
        AchievementRepository.writeNotification(t, uid, {
          title: `${candidate.icon} ${candidate.title}`,
          message: candidate.description,
          icon: candidate.icon,
          dados: { achievementId: candidate.achId, rarity: candidate.rarity },
        });

        newlyUnlocked.push(candidate.achId);
      });
    }

    return newlyUnlocked;
  },
};
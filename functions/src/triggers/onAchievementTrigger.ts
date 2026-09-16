// ============================================
// LUMINA — ACHIEVEMENT TRIGGER PROCESSOR v2.0
// functions/src/triggers/onAchievementTrigger.ts
//
// Processa documentos gravados em achievementTriggers/ por CFs
// internas (MissionService, earnXP, vault, dailyReward) que não
// podem chamar httpsCallable entre si.
//
// v2.0 — FASE 2G: toda a lógica migrou para o AchievementProcessor.
// Antes este arquivo duplicava linha a linha o checkAchievements,
// e correções precisavam ser feitas em dobro.
// ============================================

import * as firestore from 'firebase-functions/v2/firestore';
import { FieldValue }  from 'firebase-admin/firestore';
import { AchievementProcessor } from '../gamification/services/AchievementProcessor';

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

    const newlyUnlocked = await AchievementProcessor.processAction(
      uid, action, currentValue
    );

    await event.data?.ref.update({
      processedAt: FieldValue.serverTimestamp(),
      newlyUnlocked,
    });
  }
);
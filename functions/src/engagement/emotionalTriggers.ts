// ============================================
// LUMINA — EMOTIONAL TRIGGERS v5.3
// functions/src/engagement/emotionalTriggers.ts
//
// v5.3: lógica movida para EmotionalTriggersService.
// Este arquivo apenas registra os triggers do Firestore.
// ============================================

import * as firestoreFunctions  from 'firebase-functions/v2/firestore';
import * as scheduledFunctions  from 'firebase-functions/v2/scheduler';
import * as admin               from 'firebase-admin';
import { FieldValue }           from 'firebase-admin/firestore';
import { ProfileVisitOrchestrator } from '../gamification/orchestrators/ProfileVisitOrchestrator';
import { EmotionalTriggersService } from './EmotionalTriggersService';

const db = admin.firestore();

function newCorrelationId(): string {
  return `visit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const onProfileVisit = firestoreFunctions.onDocumentCreated(
  'profile_visits/{visitId}',
  async (event) => {
    const visitData = event.data?.data();
    if (!visitData) return;

    const visitorId     = visitData.visitorId as string;
    const profileId     = visitData.profileId as string;
    const correlationId = newCorrelationId();

    await ProfileVisitOrchestrator.execute({
      visitorUid: visitorId,
      targetUid:  profileId,
      correlationId,
      runEmotionalTriggers: () =>
        EmotionalTriggersService.runProfileVisitTriggers(visitorId, profileId),
    });
  }
);

export const checkLostSintonia = scheduledFunctions.onSchedule(
  { schedule: 'every 60 minutes', region: 'us-central1' },
  async () => {
    const now  = new Date();
    const snap = await db.collection('pendingLostSintonia')
      .where('processed', '==', false)
      .where('checkAfter', '<=', now)
      .limit(50).get();

    const batch = db.batch();

    for (const doc of snap.docs) {
      const data      = doc.data();
      const profileId = data.profileId as string;
      const visitorId = data.visitorId as string;
      const sintonia  = data.sintonia  as number;
      const todayStr  = new Date().toISOString().slice(0, 10);

      try {
        const voltouSnap = await db.collection('profile_visits')
          .where('visitorId', '==', visitorId)
          .where('profileId', '==', profileId)
          .where('timestamp',  '>', data.visitTime)
          .limit(1).get();

        if (voltouSnap.empty) {
          const controlRef = db.collection('triggerControl').doc(`${profileId}_${todayStr}`);
          const controlDoc = await controlRef.get();
          const control    = controlDoc.data() ?? {};
          const perdidaKey = `perdida_${visitorId}`;

          if (!control[perdidaKey] && (control.perdidaCount ?? 0) < 3) {
            await db.collection('notifications').add({
              userId: profileId, type: 'sintonia_perdida',
              title: '💔 Sintonia Perdida', message: 'Uma conexão especial não voltou.',
              read: false, dados: { visitorId, sintonia, borrado: true, podeRevelar: true },
              timestamp: FieldValue.serverTimestamp(),
            });
            await controlRef.set({
              [perdidaKey]: true,
              perdidaCount: FieldValue.increment(1),
              updatedAt:    FieldValue.serverTimestamp(),
            }, { merge: true });
          }
        }
        batch.update(doc.ref, { processed: true });
      } catch {
        batch.update(doc.ref, { processed: true });
      }
    }

    await batch.commit();
  }
);
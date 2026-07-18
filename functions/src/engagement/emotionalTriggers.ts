// ============================================
// LUMINA — EMOTIONAL TRIGGERS v5.4
// functions/src/engagement/emotionalTriggers.ts
//
// v5.4: integra LegacyShadowOrchestrator para Shadow Mode.
// Captura estado atual do XP antes de chamar o Engine,
// permitindo comparação real (não cega).
// Toda lógica existente preservada — adição cirúrgica.
// ============================================

import * as firestoreFunctions  from 'firebase-functions/v2/firestore';
import * as scheduledFunctions  from 'firebase-functions/v2/scheduler';
import * as admin               from 'firebase-admin';
import { FieldValue }           from 'firebase-admin/firestore';
import { ProfileVisitOrchestrator } from '../gamification/orchestrators/ProfileVisitOrchestrator';
import { EmotionalTriggersService } from './EmotionalTriggersService';
import { LegacyShadowOrchestrator } from '../gamification/compatibility/LegacyShadowOrchestrator';
import { CompareParams } from '../gamification/compatibility/ICompatibilityAdapter';

const db = admin.firestore();

function newCorrelationId(): string {
  return `visit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function newEventId(): string {
  return `visit_shadow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// Captura estado atual do XP do visitante — legacyResult real
async function captureXPState(uid: string): Promise<{
  currentTotalXP: number;
  currentXPToday: number;
  fertilizerActive: boolean;
} | null> {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const doc      = await db.collection('users').doc(uid).get();
    const data     = doc.data() ?? {};
    const xp       = data.xp ?? {};
    const arv      = data.progression?.arvore ?? {};

    const fertAtivo  = arv.fertilizanteAtivo === true;
    const fertExpira = arv.fertilizanteExpiraEm?.toDate?.() ?? null;

    return {
      currentTotalXP:   xp.totalXP ?? 0,
      currentXPToday:   xp.xpTodayDate === todayStr ? (xp.xpToday ?? 0) : 0,
      fertilizerActive: fertAtivo && fertExpira && fertExpira > new Date(),
    };
  } catch {
    return null;
  }
}

export const onProfileVisit = firestoreFunctions.onDocumentCreated(
  'profile_visits/{visitId}',
  async (event) => {
    const visitData = event.data?.data();
    if (!visitData) return;

    const visitorId     = visitData.visitorId as string;
    const profileId     = visitData.profileId as string;
    const correlationId = newCorrelationId();

    // SPRINT 1C: captura estado ANTES do Engine para Shadow Mode
    // Fire-and-forget paralelo — não bloqueia o fluxo principal
    const shadowPromise = (async () => {
      const preState = await captureXPState(visitorId);
      if (!preState) return;

      const eventId = newEventId();
      const xpParams: CompareParams = {
        uid:             visitorId,
        eventId,
        legacyActionKey: 'VISIT_PROFILE',
        legacyResult: {
          // legacyResult: o que o legado FARIA com esta visita
          // XP de visita sempre é VISIT_PROFILE — Calculator vai simular
          action: 'VISIT_PROFILE',
          targetUid: profileId,
        },
        calculatorInput: {
          actionKey:        'VISIT_PROFILE',
          currentTotalXP:   preState.currentTotalXP,
          currentXPToday:   preState.currentXPToday,
          fertilizerActive: preState.fertilizerActive,
        },
      };

      await LegacyShadowOrchestrator.dispatchComparisons('VISIT_PROFILE', { XP: xpParams });
    })().catch(() => { /* Shadow nunca afeta o fluxo principal */ });

    // Fluxo principal — inalterado
    await ProfileVisitOrchestrator.execute({
      visitorUid: visitorId,
      targetUid:  profileId,
      correlationId,
      runEmotionalTriggers: () =>
        EmotionalTriggersService.runProfileVisitTriggers(visitorId, profileId),
    });

    // Aguarda Shadow em paralelo (já resolveu ou não — não importa)
    await shadowPromise;
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
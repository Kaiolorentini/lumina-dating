// ============================================
// LUMINA — EMOTIONAL TRIGGERS SERVICE v2.0
// functions/src/engagement/EmotionalTriggersService.ts
//
// v2.0 (27/09):
// - QUEM VISITOU NÃO VAI MAIS NA NOTIFICAÇÃO. O id ficava em
//   dados.visitorId, legível pelo dono da notificação — a
//   revelação paga era só uma trava na tela. Agora vai para
//   triggerSecrets/{notificationId}, que só o servidor lê, e a
//   revelação é feita pela CF revealTrigger.
// - Compatibilidade pela fonte única (utils/compatibility). A cópia
//   local comparava preferência com gênero e a Quase Sintonia
//   (85+) nunca disparava.
// ============================================

import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { todayBr }    from '../utils/dateBr';
import { calcCompatibilidade } from '../utils/compatibility';

const db = admin.firestore();

export type RevealableTrigger = 'quase_sintonia' | 'pensou_em_voce' | 'sintonia_perdida';

/**
 * Notificação de gatilho SEM a identidade de quem visitou. A
 * identidade vai para triggerSecrets, no mesmo batch.
 */
export async function createTriggerNotification(
  userId:    string,
  type:      RevealableTrigger,
  title:     string,
  message:   string,
  visitorId: string,
  sintonia:  number,
): Promise<void> {
  const notifRef = db.collection('notifications').doc();
  const batch    = db.batch();

  batch.set(notifRef, {
    userId,
    type,
    title,
    message,
    read:      false,
    dados:     { sintonia, borrado: true, title },
    timestamp: FieldValue.serverTimestamp(),
  });

  batch.set(db.collection('triggerSecrets').doc(notifRef.id), {
    userId,
    visitorId,
    type,
    revealed:  false,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}

export const EmotionalTriggersService = {
  async runProfileVisitTriggers(visitorId: string, profileId: string): Promise<void> {
    // BRT: a chave triggerControl/{profileId}_{data} governa o teto
    // de 3 Sintonias Perdidas/dia.
    const todayStr = todayBr();

    const [visitorDoc, profileDoc] = await Promise.all([
      db.collection('users').doc(visitorId).get(),
      db.collection('users').doc(profileId).get(),
    ]);

    if (!visitorDoc.exists || !profileDoc.exists) return;

    // Do ponto de vista de quem RECEBE a visita.
    const sintonia   = calcCompatibilidade(profileDoc.data()!, visitorDoc.data()!);
    const controlRef = db.collection('triggerControl').doc(`${profileId}_${todayStr}`);
    const controlDoc = await controlRef.get();
    const control    = controlDoc.data() ?? {};

    // Quase Sintonia
    if (sintonia >= 85 && !control[`quase_${visitorId}`]) {
      await Promise.all([
        createTriggerNotification(
          profileId, 'quase_sintonia', '💜 Quase Sintonia',
          `Alguém com ${sintonia}% de compatibilidade viu seu perfil!`,
          visitorId, sintonia,
        ),
        controlRef.set({ [`quase_${visitorId}`]: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
      ]);
    }

    // Pensou em Você
    const visitCountKey = `visits_${visitorId}`;
    const newCount      = (control[visitCountKey] ?? 0) + 1;
    await controlRef.set({ [visitCountKey]: newCount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (newCount === 3) {
      await createTriggerNotification(
        profileId, 'pensou_em_voce', '✨ Pensou em Você',
        'Alguém visitou seu perfil 3 vezes hoje.',
        visitorId, sintonia,
      );
    }

    // Sintonia Perdida (pendente — pendingLostSintonia é só do servidor)
    const perdidaKey = `perdida_${visitorId}`;
    if (!control[perdidaKey] && (control.perdidaCount ?? 0) < 3) {
      await db.collection('pendingLostSintonia').add({
        profileId, visitorId, sintonia,
        visitTime:  FieldValue.serverTimestamp(),
        checkAfter: new Date(Date.now() + 24 * 3600000),
        processed:  false, date: todayStr,
      });
    }
  },
};
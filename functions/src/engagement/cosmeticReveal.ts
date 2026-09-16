// ============================================
// LUMINA — REVELAÇÃO DE COSMÉTICO
// functions/src/engagement/cosmeticReveal.ts
//
// FASE 8 — o app mostra um modal quando o usuário ganha uma
// moldura ou badge, e chama esta CF para não mostrar de novo.
//
// A flag vive no servidor e não em armazenamento local porque
// quem concede é o backend (aprovação de criador, conquista), e
// só ele sabe o que é novidade. Também sobrevive a reinstalação.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';

const db = admin.firestore();

export const clearCosmeticReveal = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new functions.HttpsError('unauthenticated', 'Não autenticado.');

    await db.collection('users').doc(uid).set({
      progression: { pendingCosmeticReveal: null },
    }, { merge: true });

    return { success: true };
  }
);
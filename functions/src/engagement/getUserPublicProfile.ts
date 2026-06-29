// ============================================
// LUMINA — GET USER PUBLIC PROFILE v5.1
// functions/src/engagement/getUserPublicProfile.ts
//
// Retorna dados públicos de um usuário para
// exibição após revelação de gatilho emocional.
// Só retorna após spend de cristais ser validado.
// ============================================

import * as functions from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';

const db = admin.firestore();

export const getUserPublicProfile = functions.onCall(
  { region: 'us-central1' },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
      throw new functions.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const { userId } = request.data as { userId: string };
    if (!userId) {
      throw new functions.HttpsError('invalid-argument', 'userId é obrigatório.');
    }

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.HttpsError('not-found', 'Usuário não encontrado.');
    }

    const data = userDoc.data()!;

    // Retorna apenas dados públicos — nunca email, telefone, etc.
    return {
      uid:      userId,
      name:     data.name     ?? 'Usuário',
      age:      data.age      ?? null,
      photoURL: data.photoURL ?? '',
      city:     data.city     ?? '',
      gender:   data.gender   ?? '',
    };
  }
);

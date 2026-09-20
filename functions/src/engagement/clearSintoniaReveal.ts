// ============================================
// LUMINA — LIMPAR REVELAÇÃO DE SINTONIA
// functions/src/engagement/clearSintoniaReveal.ts
//
// O MatchService grava progression.pendingSintoniaReveal nos
// dois lados; o EngagementInitializer lê ao abrir o app,
// mostra o modal e chama esta CF ao fechar.
//
// Espelha o clearCosmeticReveal. A flag vive no SERVIDOR e não
// em armazenamento local porque quem concede é o backend e ela
// precisa sobreviver a reinstalação.
//
// O campo é protegido nas rules (progression), então o cliente
// não consegue limpar sozinho.
// ============================================

import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated } from "../utils/adminGuard";

export const clearSintoniaReveal = onCall(
  { region: "us-central1" },
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const uid: string = request.auth!.uid;

    await admin.firestore().collection("users").doc(uid).set(
      {
        progression: {
          pendingSintoniaReveal: admin.firestore.FieldValue.delete(),
        },
      },
      { merge: true },
    );

    return { success: true };
  },
);
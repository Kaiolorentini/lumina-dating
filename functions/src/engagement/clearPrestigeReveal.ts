// ============================================
// LUMINA — LIMPAR REVELAÇÃO DE PRESTÍGIO
// functions/src/engagement/clearPrestigeReveal.ts
//
// O PrestigeService grava progression.pendingPrestigeReveal ao
// subir de estágio; o EngagementInitializer lê ao abrir o app,
// mostra o modal e chama esta CF ao fechar.
//
// Espelha o clearSintoniaReveal e o clearCosmeticReveal. O
// campo é protegido nas rules, então o cliente não limpa
// sozinho.
// ============================================

import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated } from "../utils/adminGuard";

export const clearPrestigeReveal = onCall(
  { region: "us-central1" },
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const uid: string = request.auth!.uid;

    await admin.firestore().collection("users").doc(uid).set(
      {
        progression: {
          pendingPrestigeReveal: admin.firestore.FieldValue.delete(),
        },
      },
      { merge: true },
    );

    return { success: true };
  },
);
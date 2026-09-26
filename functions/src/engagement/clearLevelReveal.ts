// ============================================
// LUMINA — LIMPAR REVELAÇÃO DE NÍVEL
// functions/src/engagement/clearLevelReveal.ts
//
// Espelha clearSintoniaReveal, clearPrestigeReveal e
// clearCosmeticReveal. O campo progression é protegido nas
// rules, então o cliente não limpa sozinho.
// ============================================

import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated } from "../utils/adminGuard";

export const clearLevelReveal = onCall(
  { region: "us-central1" },
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const uid: string = request.auth!.uid;

    await admin.firestore().collection("users").doc(uid).set(
      {
        progression: {
          pendingLevelReveal: admin.firestore.FieldValue.delete(),
        },
      },
      { merge: true },
    );

    return { success: true };
  },
);
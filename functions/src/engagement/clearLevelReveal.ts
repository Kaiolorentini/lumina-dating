// ============================================
// LUMINA — LIMPAR REVELAÇÃO DE NÍVEL
// functions/src/engagement/clearLevelReveal.ts
//
// Espelha clearSintoniaReveal, clearPrestigeReveal e
// clearCosmeticReveal. O campo progression é protegido nas
// rules, então o cliente não limpa sozinho.
//
// Limpa também pendingLevelReward: o marco de nível é mostrado
// no MESMO modal da subida, e sem isto a comemoração do prêmio
// voltaria a cada abertura do app.
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
          pendingLevelReveal:  admin.firestore.FieldValue.delete(),
          pendingLevelReward:  admin.firestore.FieldValue.delete(),
        },
      },
      { merge: true },
    );

    return { success: true };
  },
);
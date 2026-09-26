// ============================================
// LUMINA — TÍTULOS
// functions/src/engagement/titles.ts
//
// Títulos são conquistados, nunca comprados. O
// AchievementProcessor já concede em
// `progression.availableTitles` — array de strings, o texto do
// título como está em reward.title dos dois catálogos.
//
// Aqui só o que falta: equipar um deles e listar.
//
// O campo `progression` é protegido nas rules, então o cliente
// não equipa sozinho: precisa passar por esta CF, que valida
// que a pessoa realmente conquistou o título.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated } from "../utils/adminGuard";

const db = admin.firestore();

export const equipTitle = onCall(
  { region: "us-central1" },
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const uid: string = request.auth!.uid;

    // titleId null = remover o título ativo.
    const { titleId } = (request.data ?? {}) as { titleId?: string | null };

    const userRef = db.collection("users").doc(uid);

    if (titleId === null || titleId === undefined || titleId === "") {
      await userRef.set(
        {
          progression: {
            equippedTitle: admin.firestore.FieldValue.delete(),
          },
        },
        { merge: true },
      );
      return { success: true, equipped: null };
    }

    if (typeof titleId !== "string") {
      throw new HttpsError("invalid-argument", "titleId inválido");
    }

    const snap = await userRef.get();
    const available: string[] =
      snap.data()?.progression?.availableTitles ?? [];

    // Validação no SERVIDOR: sem isto, um app modificado equipa
    // "Fundador" sem nunca ter sido fundador.
    if (!available.includes(titleId)) {
      throw new HttpsError(
        "permission-denied",
        "Você ainda não conquistou este título",
      );
    }

    await userRef.set(
      { progression: { equippedTitle: titleId } },
      { merge: true },
    );

    console.log(`[equipTitle] ${uid} equipou: ${titleId}`);

    return { success: true, equipped: titleId };
  },
);

export const getTitlesStatus = onCall(
  { region: "us-central1" },
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const uid: string = request.auth!.uid;

    const snap = await db.collection("users").doc(uid).get();
    const prog = snap.data()?.progression ?? {};

    return {
      available:     (prog.availableTitles as string[] | undefined) ?? [],
      equippedTitle: (prog.equippedTitle as string | undefined) ?? null,
    };
  },
);
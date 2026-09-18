// ============================================
// LUMINA — FILA DE VERIFICAÇÃO
// functions/src/verification/listPendingVerifications.ts
//
// Devolve as pendências com URLs assinadas de 10 minutos.
// Curtas de propósito: se um print do link vazar, ele
// expira antes de servir para alguma coisa.
//
// Traz também o que o usuário declarou (nome, idade,
// cidade), porque o admin compara com o documento e pode
// precisar corrigir a idade na aprovação.
// ============================================

import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import {
  REQUIRED_FILES,
  SIGNED_URL_MINUTES,
  storagePathFor,
} from "./constants";

const PAGE_LIMIT = 30;

interface PendingRow {
  uid: string;
  declaredName: string | null;
  declaredAge: number | null
  city: string | null;
  state: string | null;
  email: string | null;
  attempts: number;
  submittedAt: string | null;
  /** URLs assinadas na ordem: frente, verso, selfie. */
  imageUrls: string[];
}

interface ListPendingResult {
  items: PendingRow[];
  signedUrlMinutes: number;
}

export const listPendingVerifications = onCall<void, Promise<ListPendingResult>>(
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    await assertSuperAdmin(request.auth!.uid);

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    const snap = await db
      .collection("ageVerifications")
      .where("status", "==", "pending")
      .orderBy("submittedAt", "asc")
      .limit(PAGE_LIMIT)
      .get();

    if (snap.empty) {
      return { items: [], signedUrlMinutes: SIGNED_URL_MINUTES };
    }

    const expires = Date.now() + SIGNED_URL_MINUTES * 60 * 1000;

    const items = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data();
        const uid = doc.id;

        // Dados atuais do usuário: o declaredAge foi copiado no
        // envio, mas a pessoa pode ter editado o perfil depois.
        const userSnap = await db.collection("users").doc(uid).get();
        const userData = userSnap.data() ?? {};

        const imageUrls = await Promise.all(
          REQUIRED_FILES.map(async (file) => {
            try {
              const [url] = await bucket
                .file(storagePathFor(uid, file))
                .getSignedUrl({ action: "read", expires });
              return url;
            } catch (error) {
              console.warn(`[listPendingVerifications] URL falhou: ${uid}/${file}`, error);
              return "";
            }
          }),
        );

        const submittedAt = data.submittedAt as admin.firestore.Timestamp | undefined;

        return {
          uid,
          declaredName: typeof userData.name === "string" ? userData.name : null,
          declaredAge: typeof userData.age === "number" ? userData.age : null,
          city: typeof userData.city === "string" ? userData.city : null,
          state: typeof userData.state === "string" ? userData.state : null,
          email: typeof userData.email === "string" ? userData.email : null,
          attempts: typeof data.attempts === "number" ? data.attempts : 1,
          submittedAt:
            submittedAt && typeof submittedAt.toDate === "function"
              ? submittedAt.toDate().toISOString()
              : null,
          imageUrls,
        };
      }),
    );

    console.log(`[listPendingVerifications] ${items.length} pendências`);

    return { items, signedUrlMinutes: SIGNED_URL_MINUTES };
  }
);
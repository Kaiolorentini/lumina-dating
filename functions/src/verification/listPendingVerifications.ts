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
//
// 12/10/2026 — questionário de verificação:
// • photoURL: a foto de perfil, para o item "mesma pessoa da foto
//   de perfil".
// • { userId } opcional: a tela do questionário busca só aquela
//   verificação (e renova os links de 10 minutos) sem baixar a fila
//   inteira. Sem userId, o comportamento é o de antes.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import {
  REQUIRED_FILES,
  SIGNED_URL_MINUTES,
  storagePathFor,
} from "./constants";

const PAGE_LIMIT = 30;

interface ListPendingPayload {
  userId?: string;
}

interface PendingRow {
  uid: string;
  declaredName: string | null;
  declaredAge: number | null;
  city: string | null;
  state: string | null;
  email: string | null;
  /** Foto de perfil atual (pública no app). */
  photoURL: string | null;
  attempts: number;
  submittedAt: string | null;
  /** URLs assinadas na ordem: frente, verso, selfie. */
  imageUrls: string[];
}

interface ListPendingResult {
  items: PendingRow[];
  signedUrlMinutes: number;
}

export const listPendingVerifications = onCall<ListPendingPayload | null | undefined, Promise<ListPendingResult>>(
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    await assertSuperAdmin(request.auth!.uid);

    const rawUserId = request.data?.userId;
    if (rawUserId !== undefined && (typeof rawUserId !== "string" || !rawUserId || rawUserId.includes("/"))) {
      throw new HttpsError("invalid-argument", "userId inválido");
    }

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    let docs: FirebaseFirestore.DocumentSnapshot[];
    if (rawUserId) {
      // Uma verificação só — e só se ainda estiver pendente.
      const single = await db.collection("ageVerifications").doc(rawUserId).get();
      docs = single.exists && single.data()?.status === "pending" ? [single] : [];
    } else {
      const snap = await db
        .collection("ageVerifications")
        .where("status", "==", "pending")
        .orderBy("submittedAt", "asc")
        .limit(PAGE_LIMIT)
        .get();
      docs = snap.docs;
    }

    if (docs.length === 0) {
      return { items: [], signedUrlMinutes: SIGNED_URL_MINUTES };
    }

    const expires = Date.now() + SIGNED_URL_MINUTES * 60 * 1000;

    const items = await Promise.all(
      docs.map(async (doc) => {
        const data = doc.data() ?? {};
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
          photoURL: typeof userData.photoURL === "string" && userData.photoURL ? userData.photoURL : null,
          attempts: typeof data.attempts === "number" ? data.attempts : 1,
          submittedAt:
            submittedAt && typeof submittedAt.toDate === "function"
              ? submittedAt.toDate().toISOString()
              : null,
          imageUrls,
        };
      }),
    );

    console.log(`[listPendingVerifications] ${items.length} pendências${rawUserId ? " (uma)" : ""}`);

    return { items, signedUrlMinutes: SIGNED_URL_MINUTES };
  }
);

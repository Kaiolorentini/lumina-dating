// ============================================
// LUMINA — ENVIO DA VERIFICAÇÃO
// functions/src/verification/submitAgeVerification.ts
//
// O app sobe as três imagens direto no Storage (as Rules
// permitem só ao dono) e depois chama esta função, que
// confirma que os três arquivos existem e cria o registro
// pendente.
//
// Por que confirmar em vez de confiar: sem isto, alguém
// chamaria a CF sem enviar nada e entraria na fila com
// caminhos vazios, fazendo o admin perder tempo.
//
// O status é espelhado em users/{uid} porque é de lá que o
// gate de acesso lê — o documento ageVerifications fica
// fechado ao cliente.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated } from "../utils/adminGuard";
import { notifyAdmins } from "../utils/notifyAdmins";
import { MAX_ATTEMPTS, REQUIRED_FILES, storagePathFor } from "./constants";

interface SubmitResult {
  success: boolean;
  status: "pending";
  attempt: number;
}

export const submitAgeVerification = onCall<void, Promise<SubmitResult>>(
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const uid: string = request.auth!.uid;

    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const verificationRef = db.collection("ageVerifications").doc(uid);
    const userRef = db.collection("users").doc(uid);

    const [verificationSnap, userSnap] = await Promise.all([
      verificationRef.get(),
      userRef.get(),
    ]);

    if (!userSnap.exists) {
      throw new HttpsError(
        "failed-precondition",
        "Complete seu perfil antes de enviar a verificação.",
      );
    }

    const existing = verificationSnap.data();

    if (existing?.status === "approved") {
      throw new HttpsError("already-exists", "Sua conta já está verificada.");
    }

    if (existing?.status === "pending") {
      throw new HttpsError(
        "already-exists",
        "Sua verificação já está em análise. Aguarde o resultado.",
      );
    }

    // Tentativas esgotadas: sem isto alguém reenvia sem limite
    // e enche o Storage.
    const previousAttempts = typeof existing?.attempts === "number" ? existing.attempts : 0;
    if (previousAttempts >= MAX_ATTEMPTS) {
      throw new HttpsError(
        "resource-exhausted",
        "Você atingiu o limite de tentativas. Entre em contato com o suporte.",
      );
    }

    // Confirma que as três imagens chegaram ao Storage.
    const paths = REQUIRED_FILES.map((file) => storagePathFor(uid, file));
    const existsChecks = await Promise.all(
      paths.map(async (path) => {
        const [fileExists] = await bucket.file(path).exists();
        return { path, fileExists };
      }),
    );

    const missing = existsChecks.filter((check) => !check.fileExists);
    if (missing.length > 0) {
      throw new HttpsError(
        "failed-precondition",
        "Envie as três imagens antes de confirmar: documento (frente e verso) e a selfie.",
      );
    }

    const attempt = previousAttempts + 1;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const userData = userSnap.data() ?? {};

    const batch = db.batch();

    batch.set(
      verificationRef,
      {
        uid,
        status: "pending",
        attempts: attempt,
        submittedAt: now,
        paths,
        // Cópia do que o usuário declarou no cadastro, para o
        // admin comparar com o documento sem uma leitura extra.
        declaredAge: typeof userData.age === "number" ? userData.age : null,
        declaredName: typeof userData.name === "string" ? userData.name : null,
        // Limpa o resultado da tentativa anterior.
        rejectionReason: admin.firestore.FieldValue.delete(),
        rejectionNote: admin.firestore.FieldValue.delete(),
        reviewedAt: admin.firestore.FieldValue.delete(),
        reviewedBy: admin.firestore.FieldValue.delete(),
      },
      { merge: true },
    );

    batch.set(
      userRef,
      {
        ageVerificationStatus: "pending",
        ageRejectionReason: admin.firestore.FieldValue.delete(),
        ageRejectionNote: admin.firestore.FieldValue.delete(),
      },
      { merge: true },
    );

    await batch.commit();

    console.log(`[submitAgeVerification] Pendente: ${uid} — tentativa ${attempt}`);

    // Fire-and-forget: a verificação já está registrada, e falha
    // no aviso não pode desfazer isso nem travar a resposta ao
    // usuário, que está esperando na tela.
    notifyAdmins({
      title: "🪪 Verificação de idade pendente",
      body:
        attempt > 1
          ? `${userData.name ?? "Um usuário"} reenviou o documento (${attempt}ª tentativa)`
          : `${userData.name ?? "Um usuário"} enviou o documento para análise`,
      type: "age_verification_pending",
      data: { userId: uid, attempt: String(attempt) },
    }).catch(() => {});

    return { success: true, status: "pending", attempt };
  }
);
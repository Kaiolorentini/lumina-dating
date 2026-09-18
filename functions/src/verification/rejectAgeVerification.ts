// ============================================
// LUMINA — REJEIÇÃO DA VERIFICAÇÃO
// functions/src/verification/rejectAgeVerification.ts
//
// UNDERAGE é diferente dos outros motivos: encerra a conta
// (accountBanned) em vez de permitir reenvio. Não é
// punição, é requisito legal — conteúdo adulto não pode
// ser servido a menor de idade, e permitir "tentar de novo"
// seria convidar a mandar o documento de outra pessoa.
//
// accountBanned e NÃO isBlocked: isBlocked é punição de
// marketplace, temporária. São coisas distintas.
//
// As imagens são apagadas aqui também, não só na
// aprovação — o raciocínio da LGPD é o mesmo.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { createAuditLog } from "../utils/auditLog";
import { notifyUser } from "../utils/notifyUser";
import { deleteVerificationImages } from "./deleteVerificationImages";
import { MAX_ATTEMPTS, REJECTION_REASONS, AgeRejectionReason } from "./constants";

interface RejectPayload {
  userId: string;
  reason: AgeRejectionReason;
  note?: string;
}

interface RejectResult {
  success: boolean;
  accountBanned: boolean;
  attemptsLeft: number;
}

const REASON_TEXT: Record<AgeRejectionReason, string> = {
  UNDERAGE: "O documento indica que você tem menos de 18 anos.",
  ILLEGIBLE: "Não foi possível ler o documento. Envie fotos nítidas, sem reflexo e com o documento inteiro visível.",
  MISMATCH: "A pessoa da selfie não corresponde ao documento enviado.",
  OTHER: "Sua verificação não foi aprovada.",
};

export const rejectAgeVerification = onCall<RejectPayload, Promise<RejectResult>>(
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const adminUid: string = request.auth!.uid;
    await assertSuperAdmin(adminUid);

    const { userId, reason, note } = request.data ?? {};

    if (!userId) throw new HttpsError("invalid-argument", "userId obrigatório");
    if (!reason || !REJECTION_REASONS.includes(reason)) {
      throw new HttpsError(
        "invalid-argument",
        "reason deve ser UNDERAGE, ILLEGIBLE, MISMATCH ou OTHER",
      );
    }

    const db = admin.firestore();
    const verificationRef = db.collection("ageVerifications").doc(userId);
    const userRef = db.collection("users").doc(userId);

    const isUnderage = reason === "UNDERAGE";
    const trimmedNote = typeof note === "string" ? note.trim().slice(0, 500) : "";

    let attemptsUsed = 0;

    await db.runTransaction(async (tx) => {
      const verificationSnap = await tx.get(verificationRef);
      if (!verificationSnap.exists) {
        throw new HttpsError("not-found", "Verificação não encontrada");
      }

      const data = verificationSnap.data()!;

      // Idempotência: reprocessar não pode reescrever uma
      // decisão já tomada.
      if (data.status !== "pending") {
        throw new HttpsError(
          "failed-precondition",
          `Esta verificação já foi ${data.status === "approved" ? "aprovada" : "rejeitada"}.`,
        );
      }

      attemptsUsed = typeof data.attempts === "number" ? data.attempts : 1;

      tx.update(verificationRef, {
        status: "rejected",
        rejectionReason: reason,
        rejectionNote: trimmedNote || null,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedBy: adminUid,
        // Os caminhos saem do registro junto com as imagens:
        // guardar ponteiro para arquivo apagado só confunde.
        paths: admin.firestore.FieldValue.delete(),
      });

      const userPatch: Record<string, unknown> = {
        ageVerified: false,
        ageVerificationStatus: "rejected",
        ageRejectionReason: reason,
        ageRejectionNote: trimmedNote || null,
      };

      if (isUnderage) {
        userPatch.accountBanned = true;
        userPatch.accountBannedReason = "UNDERAGE";
        userPatch.accountBannedAt = admin.firestore.FieldValue.serverTimestamp();
        userPatch.accountBannedBy = adminUid;
      }

      tx.set(userRef, userPatch, { merge: true });
    });

    // Fora da transação: o Storage não participa dela.
    const deleteResult = await deleteVerificationImages(userId);

    const attemptsLeft = isUnderage ? 0 : Math.max(0, MAX_ATTEMPTS - attemptsUsed);

    await createAuditLog({
      action: "age_verification_rejected",
      performedBy: adminUid,
      targetId: userId,
      targetType: "user",
      metadata: {
        reason,
        note: trimmedNote || null,
        accountBanned: isUnderage,
        attemptsUsed,
        attemptsLeft,
        imagesDeleted: deleteResult.deleted,
        imagesFailed: deleteResult.failed,
      },
      req: request.rawRequest,
    });

    const body = isUnderage
      ? `${REASON_TEXT.UNDERAGE} O Lumina é exclusivo para maiores de 18 anos e sua conta foi encerrada.`
      : attemptsLeft > 0
        ? `${REASON_TEXT[reason]}${trimmedNote ? ` ${trimmedNote}` : ""} Você tem ${attemptsLeft} ${attemptsLeft === 1 ? "tentativa" : "tentativas"} restantes.`
        : `${REASON_TEXT[reason]} Você atingiu o limite de tentativas — entre em contato com o suporte.`;

    await notifyUser({
      userId,
      title: isUnderage ? "Conta encerrada" : "Verificação não aprovada",
      body,
      type: "age_verification_rejected",
      data: { reason },
    });

    console.log(
      `[rejectAgeVerification] ${userId} — ${reason}, banido: ${isUnderage}, restam ${attemptsLeft}`,
    );

    return { success: true, accountBanned: isUnderage, attemptsLeft };
  }
);
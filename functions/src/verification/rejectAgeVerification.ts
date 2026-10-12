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
//
// 12/10/2026 — QUESTIONÁRIO OBRIGATÓRIO (config/ageChecklist.ts):
// • A recusa exige os 12 itens respondidos e pelo menos um negado.
//   O motivo (UNDERAGE, MISMATCH, ILLEGIBLE, OTHER) e o texto para o
//   usuário são decididos pelo SERVIDOR a partir dos itens negados —
//   o app não escolhe mais o motivo.
// • UNDERAGE (item age_18 negado) só encerra a conta se a data de
//   nascimento digitada confirmar menos de 18 anos. Sem a data, ou com
//   a data dando 18+, a recusa é barrada: encerrar conta por clique
//   errado não tem volta pelo app.
// • Itens sigilosos (adulteração, aparência de menor, conta duplicada)
//   mandam ao usuário só um texto genérico e avisam os superadmins.
// • O registro da análise vai para moderationRecords na mesma
//   transação.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { createAuditLog } from "../utils/auditLog";
import { notifyUser } from "../utils/notifyUser";
import { notifyAdmins } from "../utils/notifyAdmins";
import { deleteVerificationImages } from "./deleteVerificationImages";
import { MAX_ATTEMPTS, MIN_AGE } from "./constants";
import { syncAccessClaimsFor } from "../utils/accessClaims";
import { ageInBrt, parseBirthDate } from "./birthDate";
import { AgeChecklistError, decideAgeRejection, parseAgeChecklist } from "../config/ageChecklist";
import { writeAgeModerationRecord } from "../moderation/moderationRecords";

interface RejectPayload {
  userId: string;
  /** Questionário de verificação (12 itens, pelo menos um negado). */
  checklist: unknown;
  /** AAAA-MM-DD — obrigatório quando o item "18 anos ou mais" é negado. */
  birthDate?: string;
}

interface RejectResult {
  success: boolean;
  accountBanned: boolean;
  attemptsLeft: number;
  /** Motivo decidido pelo servidor. */
  reason: string;
  /** Texto enviado ao usuário. */
  userMessage: string;
  moderationRecordId: string;
}

export const rejectAgeVerification = onCall<RejectPayload, Promise<RejectResult>>(
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const adminUid: string = request.auth!.uid;
    await assertSuperAdmin(adminUid);

    const { userId, checklist, birthDate: rawBirthDate } = request.data ?? {};
    if (typeof userId !== "string" || !userId || userId.includes("/")) {
      throw new HttpsError("invalid-argument", "userId obrigatório");
    }

    let parsed;
    let decision;
    try {
      parsed = parseAgeChecklist(checklist);
      decision = decideAgeRejection(parsed);
    } catch (error) {
      if (error instanceof AgeChecklistError) throw new HttpsError("failed-precondition", error.message);
      throw error;
    }

    const reason = decision.code;
    const isUnderage = reason === "UNDERAGE";

    // Encerrar a conta exige a data do documento confirmando a menoridade.
    let verifiedAge: number | null = null;
    if (isUnderage) {
      if (rawBirthDate === undefined || rawBirthDate === null || rawBirthDate === "") {
        throw new HttpsError(
          "failed-precondition",
          "Para recusar por menoridade, digite a data de nascimento que está no documento.",
        );
      }
      verifiedAge = ageInBrt(parseBirthDate(rawBirthDate));
      if (verifiedAge >= MIN_AGE) {
        throw new HttpsError(
          "failed-precondition",
          `A data digitada dá ${verifiedAge} anos. Confira a data ou marque o item "18 anos ou mais" como aprovado.`,
        );
      }
    } else if (typeof rawBirthDate === "string" && rawBirthDate) {
      // Data informada sem o item negado: se ela der menos de 18, o
      // questionário está incoerente — não deixamos passar como reenvio.
      const age = ageInBrt(parseBirthDate(rawBirthDate));
      if (age < MIN_AGE) {
        throw new HttpsError(
          "failed-precondition",
          `A data digitada dá ${age} anos. Marque o item "18 anos ou mais" como negado.`,
        );
      }
    }

    const userMessage = decision.userMessage;

    const db = admin.firestore();
    const verificationRef = db.collection("ageVerifications").doc(userId);
    const userRef = db.collection("users").doc(userId);

    let attemptsUsed = 0;
    let recordId = "";

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
        rejectionNote: userMessage,
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
        ageRejectionNote: userMessage,
      };

      if (isUnderage) {
        userPatch.accountBanned = true;
        userPatch.accountBannedReason = "UNDERAGE";
        userPatch.accountBannedAt = admin.firestore.FieldValue.serverTimestamp();
        userPatch.accountBannedBy = adminUid;
      }

      tx.set(userRef, userPatch, { merge: true });

      recordId = writeAgeModerationRecord(tx, {
        userId,
        reviewerUid: adminUid,
        checklist: parsed,
        outcome: "rejected",
        rejectionCode: reason,
        verifiedAge,
        attempt: attemptsUsed,
        alert: decision.alert,
      });
    });

    // Claims alinhadas ao documento: av sai, e ban entra no UNDERAGE.
    await syncAccessClaimsFor(userId).catch((error) => {
      console.error("[rejectAgeVerification] claim de acesso falhou:", error);
    });

    // Menor de idade: derruba as sessões abertas. O token atual vale
    // até 1 h; sem isto a conta seguiria usando o app nesse intervalo.
    if (isUnderage) {
      await admin.auth().revokeRefreshTokens(userId).catch((error) => {
        console.error("[rejectAgeVerification] revogação de sessão falhou:", error);
      });
    }

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
        accountBanned: isUnderage,
        attemptsUsed,
        attemptsLeft,
        imagesDeleted: deleteResult.deleted,
        imagesFailed: deleteResult.failed,
        moderationRecordId: recordId,
        checklistVersion: parsed.version,
        rejectedItems: parsed.rejectedIds,
        alert: decision.alert,
      },
      req: request.rawRequest,
    });

    // Itens sigilosos: segunda revisão pelos superadmins. As imagens já
    // foram apagadas (LGPD); a revisão é da CONTA (perfil, denúncias,
    // contas parecidas), com o registro da análise como referência.
    if (decision.alert) {
      console.warn("[rejectAgeVerification] alerta de verificação", JSON.stringify({
        userId, reason, moderationRecordId: recordId, rejectedItems: parsed.rejectedIds,
      }));
      await notifyAdmins({
        title: "🚨 Verificação de idade suspeita",
        body: "Uma verificação foi recusada por suspeita (adulteração, aparência de menor ou conta duplicada). Revise a conta.",
        type: "age_review_alert",
        data: { userId, moderationRecordId: recordId },
      }).catch((error: unknown) => console.error("[rejectAgeVerification] alerta falhou:", error));
    }

    const body = isUnderage
      ? `${userMessage} O Lumina é exclusivo para maiores de 18 anos e sua conta foi encerrada.`
      : attemptsLeft > 0
        ? `${userMessage} Você tem ${attemptsLeft} ${attemptsLeft === 1 ? "tentativa" : "tentativas"} restantes.`
        : `${userMessage} Você atingiu o limite de tentativas — entre em contato com o suporte.`;

    await notifyUser({
      userId,
      title: isUnderage ? "Conta encerrada" : "Verificação não aprovada",
      body,
      type: "age_verification_rejected",
      data: { reason },
    });

    console.log(
      `[rejectAgeVerification] ${userId} — ${reason}, banido: ${isUnderage}, restam ${attemptsLeft}, registro ${recordId}`,
    );

    return {
      success: true,
      accountBanned: isUnderage,
      attemptsLeft,
      reason,
      userMessage,
      moderationRecordId: recordId,
    };
  }
);

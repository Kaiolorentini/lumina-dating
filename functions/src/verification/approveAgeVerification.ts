// ============================================
// LUMINA — APROVAÇÃO DA VERIFICAÇÃO
// functions/src/verification/approveAgeVerification.ts
//
// O admin DIGITA a data de nascimento que leu no documento.
// A CF calcula a idade em BRT e RECUSA aprovar menor de 18,
// mesmo que o admin clique em aprovar por engano — o clique
// não é a última barreira.
//
// A idade declarada no cadastro é corrigida quando divergir
// do documento: o `age` alimenta a busca por compatibilidade,
// e idade errada no perfil é problema de produto, não motivo
// para barrar a entrada de um adulto.
//
// A conquista de Fundador NÃO é concedida aqui: escrevemos
// em achievementTriggers e o AchievementProcessor entrega
// badge, frame, título e XP — mesmo padrão do
// onApproveCreator com CREATOR_APPROVED.
//
// Imagens apagadas DEPOIS do commit: o Storage não participa
// da transação, e falha ao apagar não pode desfazer uma
// aprovação válida.
//
// 12/10/2026 — QUESTIONÁRIO OBRIGATÓRIO (config/ageChecklist.ts):
// aprovar exige os 12 itens respondidos e TODOS aprovados. A análise
// vai para moderationRecords na mesma transação (sem dado do
// documento — só respostas, quem analisou e a idade).
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { assertAuthenticated, assertSuperAdmin, isSuperAdmin } from "../utils/adminGuard";
import { createAuditLog } from "../utils/auditLog";
import { notifyUser } from "../utils/notifyUser";
import { deleteVerificationImages } from "./deleteVerificationImages";
import { claimFounderSlot, FOUNDER_COUNTER_PATH } from "./founderCounter";
import { MIN_AGE } from "./constants";
import { syncAccessClaimsFor } from "../utils/accessClaims";
import { ageInBrt, parseBirthDate } from "./birthDate";
import { AgeChecklistError, parseAgeChecklist } from "../config/ageChecklist";
import { writeAgeModerationRecord } from "../moderation/moderationRecords";

interface ApprovePayload {
  userId: string;
  /** Data de nascimento lida no documento, formato YYYY-MM-DD. */
  birthDate: string;
  /** Questionário de verificação (12 itens, todos aprovados). */
  checklist: unknown;
}

interface ApproveResult {
  success: boolean;
  verifiedAge: number;
  ageCorrected: boolean;
  founderNumber: number | null;
}

export const approveAgeVerification = onCall<ApprovePayload, Promise<ApproveResult>>(
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const adminUid: string = request.auth!.uid;
    await assertSuperAdmin(adminUid);

    const { userId, birthDate: rawBirthDate, checklist } = request.data ?? {};
    if (typeof userId !== "string" || !userId || userId.includes("/")) {
      throw new HttpsError("invalid-argument", "userId obrigatório");
    }

    let parsed;
    try {
      parsed = parseAgeChecklist(checklist);
    } catch (error) {
      if (error instanceof AgeChecklistError) throw new HttpsError("failed-precondition", error.message);
      throw error;
    }
    if (!parsed.allApproved) {
      throw new HttpsError(
        "failed-precondition",
        "Há itens negados no questionário. Para liberar a conta, todos precisam estar aprovados — ou recuse a verificação.",
      );
    }

    const birthDate = parseBirthDate(rawBirthDate);
    const verifiedAge = ageInBrt(birthDate);

    // A barreira real: o clique do admin não aprova menor de idade.
    if (verifiedAge < MIN_AGE) {
      throw new HttpsError(
        "failed-precondition",
        `O documento indica ${verifiedAge} anos. Marque o item "18 anos ou mais" como negado e recuse em vez de aprovar.`,
      );
    }

    const db = admin.firestore();
    const verificationRef = db.collection("ageVerifications").doc(userId);
    const userRef = db.collection("users").doc(userId);
    const counterRef = db.doc(FOUNDER_COUNTER_PATH);

    // Fora da transação: leitura só para decidir se conta vaga.
    const targetIsSuperAdmin = await isSuperAdmin(userId);

    let ageCorrected = false;
    let declaredAge: number | null = null;
    let founderNumber: number | null = null;
    let founderGranted = false;
    let recordId = "";

    await db.runTransaction(async (tx) => {
      const [verificationSnap, userSnap, counterSnap] = await Promise.all([
        tx.get(verificationRef),
        tx.get(userRef),
        tx.get(counterRef),
      ]);

      if (!verificationSnap.exists) {
        throw new HttpsError("not-found", "Verificação não encontrada");
      }
      if (!userSnap.exists) {
        throw new HttpsError("not-found", "Usuário não encontrado");
      }

      const verification = verificationSnap.data()!;
      const userData = userSnap.data()!;

      if (verification.status !== "pending") {
        throw new HttpsError(
          "failed-precondition",
          `Esta verificação já foi ${verification.status === "approved" ? "aprovada" : "rejeitada"}.`,
        );
      }

      tx.update(verificationRef, {
        status: "approved",
        verifiedBirthDate: admin.firestore.Timestamp.fromDate(birthDate),
        verifiedAge,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: adminUid,
        paths: FieldValue.delete(),
      });

      const userPatch: Record<string, unknown> = {
        ageVerified: true,
        ageVerificationStatus: "approved",
        ageVerifiedAt: FieldValue.serverTimestamp(),
        ageVerifiedBy: adminUid,
        birthDate: admin.firestore.Timestamp.fromDate(birthDate),
        ageRejectionReason: FieldValue.delete(),
        ageRejectionNote: FieldValue.delete(),
      };

      declaredAge = typeof userData.age === "number" ? userData.age : null;
      if (declaredAge !== verifiedAge) {
        userPatch.age = verifiedAge;
        ageCorrected = true;
      }

      tx.set(userRef, userPatch, { merge: true });

      const claim = claimFounderSlot(
        tx,
        counterSnap,
        userRef,
        userData,
        targetIsSuperAdmin,
      );
      founderNumber = claim.founderNumber;
      founderGranted = claim.granted;

      recordId = writeAgeModerationRecord(tx, {
        userId,
        reviewerUid: adminUid,
        checklist: parsed,
        outcome: "approved",
        rejectionCode: null,
        verifiedAge,
        attempt: typeof verification.attempts === "number" ? verification.attempts : 1,
        alert: false,
      });
    });

    // Claim de acesso logo após o commit: o app vê a aprovação pelo
    // onSnapshot e renova o token. Falha aqui não desfaz a aprovação —
    // o app chama syncAccessClaims ao ver a conta aprovada sem a claim.
    await syncAccessClaimsFor(userId).catch((error) => {
      console.error("[approveAgeVerification] claim de acesso falhou:", error);
    });

    const deleteResult = await deleteVerificationImages(userId);

    // Trigger da conquista — mesmo padrão do onApproveCreator.
    // O AchievementProcessor entrega badge_fundador,
    // frame_fundador, o título e o XP.
    if (founderGranted) {
      db.collection("achievementTriggers")
        .add({
          uid: userId,
          action: "FOUNDER_JOIN",
          currentValue: 1,
          processedAt: null,
          timestamp: FieldValue.serverTimestamp(),
        })
        .catch((error) => {
          console.error("[approveAgeVerification] Trigger FOUNDER_JOIN falhou:", error);
        });
    }

    await createAuditLog({
      action: "age_verification_approved",
      performedBy: adminUid,
      targetId: userId,
      targetType: "user",
      metadata: {
        verifiedAge,
        declaredAge,
        ageCorrected,
        founderNumber,
        imagesDeleted: deleteResult.deleted,
        imagesFailed: deleteResult.failed,
        moderationRecordId: recordId,
        checklistVersion: parsed.version,
      },
      req: request.rawRequest,
    });

    const body = founderGranted
      ? `Sua conta foi verificada e liberada. Você é um dos 2000 Fundadores do Lumina — abra o app para ver sua recompensa!`
      : "Sua conta foi verificada. Bem-vindo ao Lumina!";

    await notifyUser({
      userId,
      title: "Conta liberada",
      body,
      type: "age_verification_approved",
      data: founderNumber ? { founderNumber: String(founderNumber) } : {},
    });

    console.log(
      `[approveAgeVerification] ${userId} aprovado — ${verifiedAge} anos, fundador: ${founderNumber ?? "não"}`,
    );

    return { success: true, verifiedAge, ageCorrected, founderNumber };
  }
);

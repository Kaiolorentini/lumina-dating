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

interface ApprovePayload {
  userId: string;
  /** Data de nascimento lida no documento, formato YYYY-MM-DD. */
  birthDate: string;
}

interface ApproveResult {
  success: boolean;
  verifiedAge: number;
  ageCorrected: boolean;
  founderNumber: number | null;
}

/**
 * Idade em anos completos, calculada em America/Sao_Paulo.
 * Nunca usar toISOString() para isto: em BRT ele muda o dia
 * antes da meia-noite local e alguém aniversariando hoje
 * poderia contar um ano a menos.
 */
function ageInBrt(birthDate: Date): number {
  const nowBrt = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );

  let age = nowBrt.getFullYear() - birthDate.getFullYear();
  const monthDiff = nowBrt.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && nowBrt.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

function parseBirthDate(raw: unknown): Date {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new HttpsError(
      "invalid-argument",
      "birthDate deve estar no formato AAAA-MM-DD",
    );
  }

  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  // Rejeita data inexistente (31/02 vira 03/03 no construtor).
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new HttpsError("invalid-argument", "Data de nascimento inválida");
  }

  if (date.getTime() > Date.now()) {
    throw new HttpsError("invalid-argument", "Data de nascimento no futuro");
  }

  // 120 anos: erro de digitação no ano, não pessoa centenária.
  if (year < new Date().getFullYear() - 120) {
    throw new HttpsError("invalid-argument", "Data de nascimento improvável — confira o ano");
  }

  return date;
}

export const approveAgeVerification = onCall<ApprovePayload, Promise<ApproveResult>>(
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const adminUid: string = request.auth!.uid;
    await assertSuperAdmin(adminUid);

    const { userId, birthDate: rawBirthDate } = request.data ?? {};
    if (!userId) throw new HttpsError("invalid-argument", "userId obrigatório");

    const birthDate = parseBirthDate(rawBirthDate);
    const verifiedAge = ageInBrt(birthDate);

    // A barreira real: o clique do admin não aprova menor de idade.
    if (verifiedAge < MIN_AGE) {
      throw new HttpsError(
        "failed-precondition",
        `O documento indica ${verifiedAge} anos. Rejeite com o motivo "Menor de idade" em vez de aprovar.`,
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
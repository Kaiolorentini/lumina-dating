// ============================================
// LUMINA — CONTADOR DE FUNDADORES
// functions/src/verification/founderCounter.ts
//
// As 2000 primeiras pessoas APROVADAS na verificação de
// idade ganham FOUNDER_EARLY. Contado na aprovação, não no
// cadastro: assim bot, conta abandonada e menor rejeitado
// não consomem vaga — e vaga consumida não volta.
//
// Contador atômico em documento próprio: 2000 é limite por
// CONTAGEM, e duas aprovações simultâneas sem transação
// dariam o mesmo número a duas pessoas ou estourariam o
// limite.
//
// Superadmins NÃO contam: aprovam a si mesmos em teste e
// queimariam vagas de marketing.
// ============================================

import * as admin from "firebase-admin";

export const FOUNDER_LIMIT = 2000;
export const FOUNDER_COUNTER_PATH = "counters/founders";

export interface FounderClaim {
  granted: boolean;
  founderNumber: number | null;
}

/**
 * Reserva uma vaga de fundador DENTRO de uma transação já aberta.
 * O chamador é responsável pelo commit.
 *
 * Idempotente por `founderNumber` no usuário: reprocessar uma
 * aprovação não concede duas vezes nem gasta outra vaga.
 */
export function claimFounderSlot(
  tx: admin.firestore.Transaction,
  counterSnap: admin.firestore.DocumentSnapshot,
  userRef: admin.firestore.DocumentReference,
  userData: admin.firestore.DocumentData,
  isSuperAdmin: boolean,
): FounderClaim {
  // Já é fundador: nada a fazer, e a vaga não é gasta de novo.
  if (typeof userData.founderNumber === "number") {
    return { granted: false, founderNumber: userData.founderNumber };
  }

  if (isSuperAdmin) {
    return { granted: false, founderNumber: null };
  }

  const current = counterSnap.exists
    ? (counterSnap.data()?.count as number | undefined) ?? 0
    : 0;

  if (current >= FOUNDER_LIMIT) {
    return { granted: false, founderNumber: null };
  }

  const founderNumber = current + 1;

  tx.set(
    counterSnap.ref,
    {
      count: founderNumber,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // O número fica no usuário: é a prova de que a vaga foi
  // usada e a garantia de idempotência.
  tx.set(
    userRef,
    {
      founderNumber,
      founderGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
      // O AchievementProcessor concede badge, frame e título ao
      // processar o trigger FOUNDER_JOIN, mas NÃO grava esta
      // flag — nenhuma conquista grava. Para o Fundador vale a
      // comemoração: é MYTHIC e a peça de marketing dos 2000.
      progression: { pendingCosmeticReveal: "frame_fundador" },
    },
    { merge: true },
  );

  return { granted: true, founderNumber };
}
// ============================================
// LUMINA — GUARD DE MARKETPLACE
// functions/src/utils/assertMarketplaceNotBanned.ts
//
// Barreira de SERVIDOR. Esconder a aba no cliente não
// impede nada: as rotas seguem registradas e um APK
// modificado chama a callable direto.
//
// Lança HttpsError (não Error puro) para o cliente
// receber permission-denied com mensagem legível.
// ============================================

import { HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

function formatBrDateTime(date: Date): string {
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function assertMarketplaceNotBanned(uid: string): Promise<void> {
  const snap = await admin.firestore().collection("users").doc(uid).get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "Usuário não encontrado");
  }

  const data = snap.data()!;
  if (data.isBlocked !== true) return;

  const until = data.marketplaceBanUntil as admin.firestore.Timestamp | undefined;

  // Ban com prazo já vencido não bloqueia: a restauração é
  // assíncrona (sob demanda + varredura), então o campo pode
  // ainda estar no documento.
  if (until && typeof until.toMillis === "function") {
    if (until.toMillis() <= Date.now()) return;

    throw new HttpsError(
      "permission-denied",
      `Seu acesso ao Marketplace está suspenso até ${formatBrDateTime(until.toDate())}.`
    );
  }

  throw new HttpsError(
    "permission-denied",
    "Seu acesso ao Marketplace está suspenso. Entre em contato com o suporte."
  );
}
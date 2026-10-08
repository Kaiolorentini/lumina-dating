// ============================================
// LUMINA — SINCRONIZAR CLAIMS DE ACESSO
// functions/src/verification/syncAccessClaims.ts
//
// Chamada pelo app quando o users/{uid} diz "aprovado" e o token ainda
// não tem a claim av: conta aprovada antes das claims existirem, ou
// falha ao gravar a claim logo após a aprovação.
//
// NÃO recebe dados: o servidor lê o próprio documento (gravado só pelo
// Admin SDK) e deriva as claims. Ninguém se concede acesso por aqui.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { syncAccessClaimsFor } from "../utils/accessClaims";

export const syncAccessClaims = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Usuário não autenticado");

  try {
    return await syncAccessClaimsFor(uid);
  } catch (error) {
    console.error("[syncAccessClaims] falhou para", uid, error);
    throw new HttpsError("internal", "Não foi possível atualizar seu acesso. Tente novamente.");
  }
});
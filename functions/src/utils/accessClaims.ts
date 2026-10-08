// ============================================
// LUMINA — CLAIMS DE ACESSO
// functions/src/utils/accessClaims.ts
//
// Claims no token de Auth, lidas pelas Rules sem leitura cobrada:
//   av  — conta com verificação de idade aprovada (ou admin/superadmin,
//         que pulam a verificação por design)
//   ban — conta banida (accountBanned — NÃO o isBlocked, que é o ban
//         temporário do marketplace)
//
// FONTE ÚNICA: as claims são DERIVADAS do users/{uid}, gravado só pelo
// Admin SDK. Nenhum caminho aceita valor vindo do cliente.
//
// setCustomUserClaims SUBSTITUI todas as claims: por isso o merge com
// as existentes. Só grava quando muda — o token só é reemitido quando
// necessário.
// ============================================

import * as admin from "firebase-admin";
import { isSuperAdmin } from "./adminGuard";

export interface AccessClaimsState {
  av: boolean;
  ban: boolean;
  /** true se as claims foram regravadas nesta chamada. */
  changed: boolean;
}

/** Calcula as claims a partir do documento. Banido nunca é verificado. */
export function deriveAccessClaims(
  data: Record<string, unknown>,
  privileged: boolean,
): { av: boolean; ban: boolean } {
  const ban = data.accountBanned === true;
  const verified = data.ageVerified === true && data.ageVerificationStatus === "approved";
  return { av: !ban && (verified || privileged), ban };
}

/** Lê o users/{uid} e alinha as claims do token a ele. Idempotente. */
export async function syncAccessClaimsFor(uid: string): Promise<AccessClaimsState> {
  const [userSnap, superAdmin] = await Promise.all([
    admin.firestore().collection("users").doc(uid).get(),
    isSuperAdmin(uid),
  ]);

  const data = (userSnap.data() ?? {}) as Record<string, unknown>;
  const isAdminRole = data.role === "admin" && data.isBlocked !== true;
  const target = deriveAccessClaims(data, superAdmin || isAdminRole);

  const authUser = await admin.auth().getUser(uid);
  const claims: Record<string, unknown> = { ...(authUser.customClaims ?? {}) };

  if ((claims.av === true) === target.av && (claims.ban === true) === target.ban) {
    return { ...target, changed: false };
  }

  if (target.av) claims.av = true; else delete claims.av;
  if (target.ban) claims.ban = true; else delete claims.ban;

  await admin.auth().setCustomUserClaims(uid, claims);
  console.log(`[accessClaims] ${uid} — av: ${target.av}, ban: ${target.ban}`);

  return { ...target, changed: true };
}
// ============================================
// LUMINA — CONTA VERIFICADA (SERVIDOR)
// functions/src/utils/assertVerified.ts
//
// assertVerified: quem CHAMA precisa ter a claim av (verificação
//   aprovada) e não ter ban. Lê o token — sem leitura no Firestore.
// isVerifiedProfile: o perfil ALVO (curtida, visita) precisa ser
//   verificado e não banido. Lê o documento já carregado.
//
// As claims são gravadas por utils/accessClaims.ts.
// ============================================

import { HttpsError } from "firebase-functions/v2/https";

interface CallerAuth {
  uid: string;
  token: { [key: string]: unknown };
}

export function assertVerified(auth: CallerAuth | undefined): asserts auth is CallerAuth {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Não autenticado.");
  }
  if (auth.token.ban === true) {
    throw new HttpsError("permission-denied", "Esta conta foi encerrada.");
  }
  if (auth.token.av !== true) {
    throw new HttpsError(
      "permission-denied",
      "Conclua a verificação da sua conta para usar este recurso.",
    );
  }
}

export function isVerifiedProfile(data: Record<string, unknown> | undefined): boolean {
  return !!data &&
    data.ageVerified === true &&
    data.ageVerificationStatus === "approved" &&
    data.accountBanned !== true;
}
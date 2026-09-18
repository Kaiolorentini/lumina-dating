// ============================================
// LUMINA — VERIFICAÇÃO DE IDADE, CONSTANTES
// functions/src/verification/constants.ts
// ============================================

/** Os três arquivos exigidos, na ordem em que o app pede. */
export const REQUIRED_FILES = ["doc_front", "doc_back", "selfie"] as const;
export type RequiredFile = typeof REQUIRED_FILES[number];

/** Reenvios permitidos após rejeição. Depois disso, só suporte. */
export const MAX_ATTEMPTS = 3;

/** Idade mínima. Conteúdo adulto — não é configurável por região. */
export const MIN_AGE = 18;

/** Validade da URL assinada que o admin usa para ver as imagens. */
export const SIGNED_URL_MINUTES = 10;

export type AgeVerificationStatus = "pending" | "approved" | "rejected";

export type AgeRejectionReason = "UNDERAGE" | "ILLEGIBLE" | "MISMATCH" | "OTHER";

export const REJECTION_REASONS: AgeRejectionReason[] = [
  "UNDERAGE",
  "ILLEGIBLE",
  "MISMATCH",
  "OTHER",
];

/** Caminho no Storage. Único ponto que monta isso. */
export function storagePathFor(uid: string, file: RequiredFile): string {
  return `age_verification/${uid}/${file}.jpg`;
}
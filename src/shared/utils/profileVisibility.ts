// ============================================
// LUMINA — QUEM APARECE PARA OUTRAS PESSOAS
// src/shared/utils/profileVisibility.ts
//
// Só perfil com verificação de idade APROVADA e conta não banida
// entra no feed, no Sintonize e no Em Alta. Sem isto, quem
// preencheu o perfil e ainda não foi verificado — inclusive quem
// depois foi rejeitado como menor de idade — aparecia para todos.
//
// Espelha isVerifiedProfile em functions/src/utils/assertVerified.ts:
// o servidor recusa curtida e visita a quem não passa aqui.
// ============================================

export function isListableProfile(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.ageVerified === true &&
    d.ageVerificationStatus === 'approved' &&
    d.accountBanned !== true;
}
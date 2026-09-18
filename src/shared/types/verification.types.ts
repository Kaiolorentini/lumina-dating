// ============================================
// LUMINA — VERIFICAÇÃO DE IDADE E TERMOS
// src/shared/types/verification.types.ts
//
// Estado de acesso lido do documento users/{uid}.
// Todos os campos são gravados SOMENTE pelo Admin SDK
// (Cloud Functions) e protegidos nas Firestore Rules.
// O cliente apenas lê para decidir qual árvore mostrar.
// ============================================

export type AgeVerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type AgeRejectionReason = 'UNDERAGE' | 'ILLEGIBLE' | 'MISMATCH' | 'OTHER';

export interface AccessGateState {
  /** true somente com ageVerified === true E status 'approved'. */
  ageVerified: boolean;
  ageVerificationStatus: AgeVerificationStatus;
  ageRejectionReason: AgeRejectionReason | null;
  /** Observação livre do moderador, exibida ao usuário rejeitado. */
  ageRejectionNote: string | null;
  /** Versão dos Termos de Uso + Política de Privacidade do APP. */
  acceptedAppTermsVersion: string | null;
}

export const EMPTY_ACCESS_GATE: AccessGateState = {
  ageVerified: false,
  ageVerificationStatus: 'none',
  ageRejectionReason: null,
  ageRejectionNote: null,
  acceptedAppTermsVersion: null,
};
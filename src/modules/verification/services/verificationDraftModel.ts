// ============================================
// LUMINA — RASCUNHO DA VERIFICAÇÃO: TIPOS
// src/modules/verification/services/verificationDraftModel.ts
//
// Fonte única dos tipos do rascunho, usada pelo app
// (verificationDraft.ts) e pelo navegador (verificationDraft.web.ts).
// ============================================

import { VerificationStep } from '../../../config/verification';

export type DraftCaptures = Partial<Record<VerificationStep, string>>;

export interface VerificationDraft {
  captures: DraftCaptures;
  stepIndex: number;
  /** Etapa com a câmera aberta. Sobrevive ao encerramento do app. */
  pendingStep: VerificationStep | null;
  updatedAt: number;
}

export const EMPTY_DRAFT: VerificationDraft = {
  captures: {},
  stepIndex: 0,
  pendingStep: null,
  updatedAt: 0,
};

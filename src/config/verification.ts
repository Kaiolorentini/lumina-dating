// ============================================
// LUMINA — VERIFICAÇÃO DE IDADE, CONFIG DO CLIENTE
// src/config/verification.ts
//
// ESPELHO de functions/src/verification/constants.ts.
// Ao mudar um, mudar o outro: o backend revalida tudo, mas
// divergência aqui faz o app pedir arquivo com nome que o
// servidor não reconhece.
//
// Não importa do backend: pastas separadas, tsconfig
// separado. O espelhamento manual é dívida conhecida do
// projeto (COSTS/SpendableFeature já falhou duas vezes).
// ============================================

export const VERIFICATION_STEPS = ['doc_front', 'doc_back', 'selfie'] as const;
export type VerificationStep = typeof VERIFICATION_STEPS[number];

export const MAX_ATTEMPTS = 3;
export const MAX_IMAGE_MB = 8;

export interface StepCopy {
  step: VerificationStep;
  title: string;
  instruction: string;
  /** Regras curtas que o admin usa para rejeitar — dizer antes evita a rejeição. */
  tips: string[];
}

// Instrução por etapa: verificação é onde as pessoas mais
// erram e desistem. Cada rejeição por foto ilegível custa
// tempo de moderação e uma das 3 tentativas do usuário.
export const STEP_COPY: Record<VerificationStep, StepCopy> = {
  doc_front: {
    step: 'doc_front',
    title: 'Frente do documento',
    instruction:
      'Fotografe a FRENTE do seu RG, CNH ou passaporte. A foto e a data de nascimento precisam estar legíveis.',
    tips: [
      'Documento inteiro dentro do quadro',
      'Sem reflexo do flash sobre os dados',
      'Sobre superfície plana, boa iluminação',
      'Documento original, não fotocópia',
    ],
  },
  doc_back: {
    step: 'doc_back',
    title: 'Verso do documento',
    instruction:
      'Agora o VERSO do mesmo documento. Se for passaporte, fotografe a página de assinatura.',
    tips: [
      'Mesmo documento da etapa anterior',
      'Documento inteiro dentro do quadro',
      'Sem dedos cobrindo informações',
    ],
  },
  selfie: {
    step: 'selfie',
    title: 'Selfie com o documento',
    instruction:
      'Tire uma foto sua segurando o documento ao lado do rosto, com a frente virada para a câmera.',
    tips: [
      'Seu rosto e o documento na mesma foto',
      'Rosto descoberto, sem óculos escuros ou boné',
      'Documento legível na foto',
      'Ambiente claro, sem contraluz',
    ],
  },
};

/** Motivos de rejeição, no texto que o usuário vê. */
export const REJECTION_TEXT: Record<string, string> = {
  UNDERAGE: 'O documento indica que você tem menos de 18 anos.',
  ILLEGIBLE: 'Não foi possível ler o documento enviado.',
  MISMATCH: 'A pessoa da selfie não corresponde ao documento.',
  OTHER: 'Sua verificação não foi aprovada.',
};
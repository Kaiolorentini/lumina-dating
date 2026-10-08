// ============================================
// LUMINA — PRÉ-CADASTRO DA LANDING
// functions/src/config/preRegistration.ts
//
// Fonte única das constantes do pré-cadastro.
// O espelho no site fica em lumina-landing/js/config.js —
// CONSENT_VERSION e as categorias precisam ser iguais nos dois.
// ============================================

export const PRE_REGISTRATION_COLLECTION = 'preRegistrations';

// Contador do Programa Criadores Fundadores (documento fechado ao cliente).
export const CREATOR_FOUNDER_COUNTER_PATH = 'counters/creatorFounders';

export const CREATOR_FOUNDER_LIMIT = 2000;

// Versão do texto de consentimento exibido no formulário.
// Mudou o texto? Suba a versão aqui e no js/config.js do site.
export const PRE_REGISTRATION_CONSENT_VERSION = '2026-10-04';

export const PRE_REGISTRATION_CATEGORIES = ['fotos', 'videos', 'cursos', 'pdfs', 'varios'] as const;

export type PreRegistrationCategory = (typeof PRE_REGISTRATION_CATEGORIES)[number];

export type PreRegistrationType = 'user' | 'creator';
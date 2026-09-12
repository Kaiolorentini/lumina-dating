// ============================================
// LUMINA — PREMIUM FEATURE FLAGS v5.1
// functions/src/premium/config/premiumFlags.ts
//
// REGRA 2: Feature Flags — desligar sem publicar app
// REGRA 3: Versionamento por feature
// ============================================

export const PREMIUM_FLAGS = {
  PREMIUM_TURBO_ENABLED:            true,
  PREMIUM_FERTILIZER_ENABLED:       true,
  PREMIUM_OFFERS_ENABLED:           true,
  PREMIUM_WEEKLY_CHALLENGE_ENABLED: true,
  PREMIUM_VISITORS_ENABLED:         true,
  PREMIUM_IMPULSO_ENABLED:          true,
  PREMIUM_DESTAQUE_ENABLED:         true,
};
export const PREMIUM_VERSIONS = {
  TURBO:     1,
  FERTILIZER: 1,
  OFFER:     1,
  CHALLENGE: 1,
  VISITORS:  1,
  IMPULSO:   1,
  DESTAQUE:  1,
};
// Custos em Cristais Premium
export const PREMIUM_COSTS = {
  TURBO:      120,
  FERTILIZER:  80,
};

// Durações
export const PREMIUM_DURATIONS = {
  TURBO_MINUTES:          30,
  FERTILIZER_HOURS:       24,
  OFFER_VALID_MINUTES:    60,
  TURBO_COOLDOWN_SECS:    300,
  VISITORS_HOURS:         24,
  IMPULSO_MINUTES:        30,
  IMPULSO_COOLDOWN_SECS:  300,
    DESTAQUE_HOURS:           4, // duração do Destaque Regional
  DESTAQUE_COOLDOWN_SECS: 300, // 5 minutos entre ativações
};
// REGRA 4: Turbo Score — multiplicadores centralizados
export const TURBO_SCORE = {
  BASE:       100,
  MULTIPLIER: 1.8,
};

// REGRA 10: Estados UX padronizados
export type PremiumFeatureStatus =
  | 'LOCKED'    // sem cristais premium
  | 'READY'     // disponível para usar
  | 'ACTIVE'    // ativado e correndo
  | 'EXPIRED'   // expirou
  | 'COOLDOWN'; // aguardando cooldown
  // Mínimo de usuários na região para liberar o Destaque Regional.
// ⚠️ EM TESTE: 1. Subir para 15 antes do lançamento — abaixo disso
// o comprador não tem audiência e o produto não entrega.
export const DESTAQUE_MIN_USERS_IN_REGION = 3;
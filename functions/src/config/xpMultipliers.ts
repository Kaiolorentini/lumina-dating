// ============================================
// LUMINA — XP MULTIPLIERS v5.2
// functions/src/config/xpMultipliers.ts
//
// REGRA 19: Multiplicadores centralizados
// Nunca escrever xp * 1.5 espalhado pelo código
// ============================================

export type XPCategory = 'SOCIAL' | 'MISSION' | 'ACHIEVEMENT' | 'PREMIUM' | 'EVENT';

export const XP_MULTIPLIERS: Record<string, number> = {
  NORMAL:         1.0,
  FERTILIZER:     1.5,  // Fertilizante da Sintonia — Premium
  EVENT_DOUBLE:   2.0,  // Evento especial (ex: Fim de Semana da Sintonia)
  EVENT_TRIPLE:   3.0,  // Evento raro
  STAFF:          1.0,  // Staff nunca tem multiplicador especial
};

// Feature Flags (REGRA 24) — desligar sistemas sem update do app
export const XP_FEATURE_FLAGS = {
  XP_ENABLED:          true,
  TREE_ENABLED:        true,
  FERTILIZER_ENABLED:  true,
  ANTI_BOT_ENABLED:    true,
  PRESTIGE_ENABLED:    false, // reservado para futuro
};

// Limites anti-bot (REGRA 18)
export const ANTI_BOT = {
  MAX_ACTIONS_PER_MINUTE: 10,
  RISK_SCORE_THRESHOLD:   50,  // acima disso: XP em revisão
  BLOCK_THRESHOLD:        100, // acima disso: XP bloqueado
};
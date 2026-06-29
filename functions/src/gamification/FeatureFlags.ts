// ============================================
// LUMINA — GAMIFICATION FEATURE FLAGS v1.1
// functions/src/gamification/FeatureFlags.ts
//
// BLOCO 1 — Fundação (v2)
// Controla quais sistemas estão ativos server-side.
// Sem publicar nova versão do app.
// ============================================

import { DispatcherType } from './GameEventTypes';

// Engine principal
export const GAMIFICATION_ENGINE_ENABLED = true;

// Middleware flags
export const MIDDLEWARE_FLAGS = {
  VALIDATION:   true,
  RISK:         true,
  IDEMPOTENCY:  true,
  FEATURE_FLAG: true,
  ANALYTICS:    true,
  LOGGING:      true,
};

// Dispatcher flags
export const DISPATCHER_FLAGS: Record<DispatcherType, boolean> = {
  XP:           true,
  VAULT:        true,
  ACHIEVEMENT:  true,
  MISSION:      true,
  RANKING:      true,
  TREE:         true,
  PRESTIGE:     true,
  NOTIFICATION: true,
  ANALYTICS:    true,
};

// Helper: verifica se um dispatcher está habilitado
export function isDispatcherEnabled(dispatcher: DispatcherType): boolean {
  return GAMIFICATION_ENGINE_ENABLED && (DISPATCHER_FLAGS[dispatcher] ?? false);
}

// Helper: verifica se um middleware está habilitado
export function isMiddlewareEnabled(key: keyof typeof MIDDLEWARE_FLAGS): boolean {
  return GAMIFICATION_ENGINE_ENABLED && (MIDDLEWARE_FLAGS[key] ?? false);
}
// ============================================
// LUMINA — FEATURE FLAG MIDDLEWARE v1.0
// functions/src/gamification/middlewares/FeatureFlagMiddleware.ts
//
// BLOCO 2 — Núcleo do Engine
// Verifica se o Engine e o tipo de evento estão ativos.
// ============================================

import { GameEventType } from '../GameEventTypes';
import { GAMIFICATION_ENGINE_ENABLED } from '../FeatureFlags';

export interface FeatureFlagResult {
  allowed: boolean;
  reason?: string;
}

// Eventos que podem ser desligados individualmente
const DISABLED_EVENTS: Partial<Record<GameEventType, boolean>> = {
  // Exemplo: 'PROFILE_VISIT': true → desligado
};

export function checkFeatureFlags(eventType: GameEventType): FeatureFlagResult {
  if (!GAMIFICATION_ENGINE_ENABLED) {
    return { allowed: false, reason: 'GamificationEngine desabilitado' };
  }

  if (DISABLED_EVENTS[eventType]) {
    return { allowed: false, reason: `Evento ${eventType} desabilitado` };
  }

  return { allowed: true };
}
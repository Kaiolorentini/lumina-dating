// ============================================
// LUMINA — VALIDATION MIDDLEWARE v1.0
// functions/src/gamification/middlewares/ValidationMiddleware.ts
//
// BLOCO 2 — Núcleo do Engine
// Valida a estrutura do evento.
// Retorna erro descritivo ou null se válido.
// ============================================

import { GameEventInput }  from '../GameEventContext';
import { getPolicyForEvent } from '../EventPolicies';

export interface ValidationResult {
  valid:  boolean;
  errors: string[];
}

export function validate(input: GameEventInput): ValidationResult {
  const errors: string[] = [];

  if (!input.uid)       errors.push('uid obrigatório');
  if (!input.eventId)   errors.push('eventId obrigatório');
  if (!input.eventType) errors.push('eventType obrigatório');
  if (!input.source)    errors.push('source obrigatório');
  if (!input.origin)    errors.push('origin obrigatório');

  // Verifica se targetUid é obrigatório para este evento
  const policy = getPolicyForEvent(input.eventType);
  if (policy.requiresTargetUid && !input.targetUid) {
    errors.push(`targetUid obrigatório para o evento ${input.eventType}`);
  }

  return { valid: errors.length === 0, errors };
}
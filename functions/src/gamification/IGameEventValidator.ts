// ============================================
// LUMINA — IGAME EVENT VALIDATOR v1.0
// functions/src/gamification/IGameEventValidator.ts
//
// BLOCO 5 — Interface única para todos os Validators.
// Nunca criar Validators fora deste padrão.
// ============================================

import { GameEventType } from './GameEventTypes';

export interface ValidatorContext {
  uid:           string;
  targetUid?:    string;
  eventType:     GameEventType;
  correlationId: string;
  meta?:         Record<string, unknown>;
}

// Interface que todos os Validators implementam
export interface IGameEventValidator {
  // Retorna true se este validator lida com o eventType
  canHandle(eventType: GameEventType): boolean;

  // Valida o contexto — lança ValidationError se inválido
  validate(ctx: ValidatorContext): Promise<void>;
}
// ============================================
// LUMINA — ERROR BOUNDARY v1.0
// functions/src/gamification/ErrorBoundary.ts
//
// BLOCO 4 — Regra 6: único ponto de captura de erros.
// Cada camada lança exceções.
// Só o Orchestrator captura via ErrorBoundary.
// ============================================

import { GameLogger } from './GameLogger';

export interface BoundaryError {
  code:    string;
  message: string;
  layer:   'VALIDATION' | 'TRIGGER' | 'GAMIFICATION' | 'ORCHESTRATOR';
  fatal:   boolean;   // se true: encerra o fluxo
}

export class ValidationError extends Error {
  readonly code:  string;
  readonly fatal: boolean;
  constructor(code: string, message: string, fatal = false) {
    super(message);
    this.code  = code;
    this.fatal = fatal;
  }
}

export class TriggerError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export class GamificationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// Captura e classifica erros — só o Orchestrator usa
export function handleError(
  error:     unknown,
  context:   { uid: string; eventId: string; correlationId: string }
): BoundaryError {
  if (error instanceof ValidationError) {
    GameLogger.warn({
      dispatcher: 'ANALYTICS',
      eventId:    context.eventId,
      uid:        context.uid,
      message:    `Validação falhou: ${error.message}`,
      warning:    error.code,
      meta:       { correlationId: context.correlationId },
    });
    return { code: error.code, message: error.message, layer: 'VALIDATION', fatal: error.fatal };
  }

  if (error instanceof TriggerError) {
    GameLogger.error({
      dispatcher: 'NOTIFICATION',
      eventId:    context.eventId,
      uid:        context.uid,
      message:    `Trigger falhou: ${error.message}`,
      error:      error.code,
      meta:       { correlationId: context.correlationId },
    });
    return { code: error.code, message: error.message, layer: 'TRIGGER', fatal: false };
  }

  if (error instanceof GamificationError) {
    GameLogger.error({
      dispatcher: 'XP',
      eventId:    context.eventId,
      uid:        context.uid,
      message:    `Engine falhou: ${error.message}`,
      error:      error.code,
      meta:       { correlationId: context.correlationId },
    });
    return { code: error.code, message: error.message, layer: 'GAMIFICATION', fatal: false };
  }

  // Erro desconhecido
  const msg = error instanceof Error ? error.message : String(error);
  GameLogger.error({
    dispatcher: 'ANALYTICS',
    eventId:    context.eventId,
    uid:        context.uid,
    message:    `Erro inesperado: ${msg}`,
    error:      'UNKNOWN_ERROR',
    meta:       { correlationId: context.correlationId },
  });
  return { code: 'UNKNOWN_ERROR', message: msg, layer: 'ORCHESTRATOR', fatal: false };
}
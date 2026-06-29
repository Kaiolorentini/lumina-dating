// ============================================
// LUMINA — LOGGING MIDDLEWARE v1.0
// functions/src/gamification/middlewares/LoggingMiddleware.ts
//
// BLOCO 2 — Núcleo do Engine
// Logger estruturado único — nunca usar console.log espalhado.
// Formato: Event → Dispatcher → Tempo → Resultado → Erro
// ============================================

import { GameEventResult } from '../GameEventContext';
import { EventLifecycle }  from '../EventLifecycle';

export interface LogEntry {
  eventId:   string;
  eventType: string;
  uid:       string;
  lifecycle: EventLifecycle;
  message:   string;
  durationMs?: number;
  meta?:     Record<string, unknown>;
}

// Logger estruturado — substitui console.log espalhado
export const Logger = {
  info(entry: LogEntry): void {
    console.info(JSON.stringify({ level: 'INFO', ...entry, ts: new Date().toISOString() }));
  },

  warn(entry: LogEntry): void {
    console.warn(JSON.stringify({ level: 'WARN', ...entry, ts: new Date().toISOString() }));
  },

  error(entry: LogEntry & { error: string }): void {
    console.error(JSON.stringify({ level: 'ERROR', ...entry, ts: new Date().toISOString() }));
  },

  // Log de resultado final do evento
  result(result: GameEventResult): void {
    console.info(JSON.stringify({
      level:     'RESULT',
      eventId:   result.eventId,
      eventType: result.eventType,
      uid:       result.uid,
      status:    result.status,
      executed:  result.dispatchersExecuted,
      skipped:   result.dispatchersSkipped,
      errors:    result.errors,
      durationMs: result.totalDurationMs,
      ts:        new Date().toISOString(),
    }));
  },
};
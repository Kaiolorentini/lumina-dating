// ============================================
// LUMINA — GAME LOGGER v1.0
// functions/src/gamification/GameLogger.ts
//
// BLOCO 3 — Logger estruturado para todos os Dispatchers.
// MELHORIA 14: Dispatchers nunca usam console.log.
// ============================================

import { DispatcherType } from './GameEventTypes';

interface DispatcherLog {
  dispatcher: DispatcherType;
  eventId:    string;
  uid:        string;
  message:    string;
  durationMs?: number;
  meta?:      Record<string, unknown>;
}

export const GameLogger = {
  info(entry: DispatcherLog): void {
    console.info(JSON.stringify({ level: 'INFO',  ...entry, ts: new Date().toISOString() }));
  },
  warn(entry: DispatcherLog & { warning: string }): void {
    console.warn(JSON.stringify({ level: 'WARN',  ...entry, ts: new Date().toISOString() }));
  },
  error(entry: DispatcherLog & { error: string }): void {
    console.error(JSON.stringify({ level: 'ERROR', ...entry, ts: new Date().toISOString() }));
  },
};
// ============================================
// LUMINA — IGAME DISPATCHER v1.0
// functions/src/gamification/IGameDispatcher.ts
//
// BLOCO 3 — Interface única para todos os Dispatchers.
// Todo Dispatcher implementa obrigatoriamente esta interface.
// ============================================

import { DispatcherType, EventPriority } from './GameEventTypes';
import { GameEventInput, DispatcherResult } from './GameEventContext';

// Metadata de cada Dispatcher (MELHORIA 11)
export interface DispatcherMetadata {
  name:       string;
  version:    number;
  type:       DispatcherType;
  timeoutMs:  number;
  retryable:  boolean;           // MELHORIA 7
  priority:   EventPriority;     // MELHORIA 8
}

// Interface única — todos os Dispatchers implementam
export interface IGameDispatcher {
  // Retorna metadata do dispatcher
  getMetadata(): DispatcherMetadata;

  // Verifica se pode processar este tipo de evento
  canHandle(input: GameEventInput): boolean;

  // Executa o dispatcher
  dispatch(input: GameEventInput): Promise<DispatcherResult>;
}
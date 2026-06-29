// ============================================
// LUMINA — IEVENT ORCHESTRATOR v1.0
// functions/src/gamification/IEventOrchestrator.ts
//
// BLOCO 5 — Interface única para todos os Orchestrators.
// Todos implementam execute(), validate(), buildEvent().
// ============================================

import { GameEventInput }  from './GameEventContext';
import { GameEventType }   from './GameEventTypes';

export interface OrchestratorInput {
  uid:           string;
  targetUid?:    string;
  correlationId: string;
  platform?:     'ios' | 'android' | 'web';
  sessionId?:    string;
  meta?:         Record<string, unknown>;
}

// Interface que todos os Orchestrators implementam
export interface IEventOrchestrator {
  // Tipo de evento que este orchestrator processa
  readonly eventType: GameEventType;

  // Valida as pré-condições (chama Validator interno)
  validate(input: OrchestratorInput): Promise<void>;

  // Constrói o GameEvent via Factory
  buildEvent(input: OrchestratorInput): GameEventInput;

  // Executa o fluxo completo
  execute(input: OrchestratorInput): Promise<void>;
}
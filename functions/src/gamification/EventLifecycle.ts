// ============================================
// LUMINA — EVENT LIFECYCLE v1.0
// functions/src/gamification/EventLifecycle.ts
//
// BLOCO 2 — Núcleo do Engine
// Enum de ciclo de vida de um evento.
// Sem lógica de negócio.
// ============================================

// Estados possíveis de um evento (MELHORIA 10)
export type EventLifecycle =
  | 'RECEIVED'     // evento chegou ao Engine
  | 'VALIDATED'    // passou pela ValidationMiddleware
  | 'QUEUED'       // aguardando processamento
  | 'PROCESSING'   // dispatchers em execução
  | 'COMPLETED'    // todos dispatchers concluídos
  | 'FAILED'       // um ou mais dispatchers falharam
  | 'RETRY'        // enfileirado para nova tentativa
  | 'DEADLETTER';  // excedeu tentativas máximas

// Decisão de risco (MELHORIA 7)
export type RiskDecision = 'ALLOW' | 'LIMIT' | 'BLOCK';
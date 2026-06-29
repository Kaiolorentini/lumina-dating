// ============================================
// LUMINA — GAME EVENT TYPES v1.1
// functions/src/gamification/GameEventTypes.ts
//
// BLOCO 1 — Fundação (v2)
// Tipos, enums e interfaces. Sem lógica de negócio.
// v1.1: Priority, EventSource, EventOrigin, schemaVersion
// ============================================

// Tipos de eventos suportados
export type GameEventType =
  | 'PROFILE_VISIT'
  | 'PROFILE_LIKE'
  | 'MATCH_CREATED'
  | 'MESSAGE_REPLY'
  | 'MISSION_COMPLETED'
  | 'VAULT_CLAIM'
  | 'LEVEL_UP'
  | 'TREE_EVOLUTION'
  | 'ACHIEVEMENT_UNLOCKED';

// Dispatchers disponíveis
export type DispatcherType =
  | 'XP'
  | 'VAULT'
  | 'ACHIEVEMENT'
  | 'MISSION'
  | 'RANKING'
  | 'TREE'
  | 'PRESTIGE'
  | 'NOTIFICATION'
  | 'ANALYTICS';

// Status de processamento
export type EventStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'DEAD_LETTER';

// Status de um dispatcher individual
export type DispatcherStatus =
  | 'SUCCESS'
  | 'SKIPPED'
  | 'FAILED'
  | 'DISABLED';

// Prioridade do evento (MELHORIA 2)
export type EventPriority = 'HIGH' | 'NORMAL' | 'LOW';

// Origem do evento — quem disparou (MELHORIA 9)
export type EventSource = 'APP' | 'FUNCTION' | 'ADMIN' | 'SYSTEM';

// Contexto do evento — de onde vem (MELHORIA 10)
export type EventOrigin =
  | 'PROFILE'
  | 'CHAT'
  | 'MATCH'
  | 'MISSION'
  | 'VAULT'
  | 'SYSTEM';

// Versão do protocolo de eventos
export const GAME_EVENT_VERSION  = 1;

// Versão do schema dos dados (MELHORIA 8)
export const GAME_SCHEMA_VERSION = 1;
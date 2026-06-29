// ============================================
// LUMINA — GAME EVENT CONTEXT v1.1
// functions/src/gamification/GameEventContext.ts
//
// BLOCO 1 — Fundação (v2)
// Interfaces de entrada e saída do Engine.
// v1.1: requestId, sessionId, deviceId, platform,
//       dispatcherResults detalhados, schemaVersion
// ============================================

import {
  GameEventType,
  DispatcherType,
  DispatcherStatus,
  EventStatus,
  EventPriority,
  EventSource,
  EventOrigin,
  GAME_EVENT_VERSION,
  GAME_SCHEMA_VERSION,
} from './GameEventTypes';

// Dados extras por tipo de evento
export interface GameEventMeta {
  // MESSAGE_REPLY
  messageCount?: number;

  // MISSION_COMPLETED
  missionId?:      string;
  missionCategory?: string;

  // LEVEL_UP / TREE_EVOLUTION
  xpAmount?:  number;
  treeStage?: number;

  // ACHIEVEMENT_UNLOCKED
  achievementId?: string;

  // VAULT_CLAIM
  vaultFragments?: number;
}

// Payload de entrada de um evento (MELHORIA 1 + 9 + 10)
export interface GameEventInput {
  eventId:      string;          // ID único — gerado pela GameEventFactory
  eventType:    GameEventType;
  uid:          string;          // quem realizou a ação
  targetUid?:   string;          // usuário alvo (ex: dono do perfil visitado)
  meta?:        GameEventMeta;

  // Contexto de debug e auditoria
  source:       EventSource;     // quem disparou: APP | FUNCTION | ADMIN | SYSTEM
  origin:       EventOrigin;     // de onde vem: PROFILE | CHAT | MATCH | etc.
  requestId?:   string;          // ID da requisição HTTP (se disponível)
  sessionId?:   string;          // sessão do usuário
  deviceId?:    string;          // identificador do dispositivo
  appVersion?:  string;          // versão do app (ex: "1.4.2")
  platform?:    'ios' | 'android' | 'web';
  locale?:      string;          // ex: "pt-BR"
}

// Resultado detalhado de um dispatcher (MELHORIA 4)
export interface DispatcherResult {
  dispatcher:    DispatcherType;
  status:        DispatcherStatus;
  durationMs:    number;
  warnings?:     string[];
  errors?:       string[];
}

// Resultado completo do processamento (MELHORIA EventLedger)
export interface GameEventResult {
  eventId:             string;
  eventType:           GameEventType;
  uid:                 string;
  status:              EventStatus;
  priority:            EventPriority;
  eventVersion:        number;
  schemaVersion:       number;           // MELHORIA 8
  source:              EventSource;
  origin:              EventOrigin;
  dispatcherResults:   DispatcherResult[];
  dispatchersExecuted: DispatcherType[];
  dispatchersSkipped:  DispatcherType[];
  totalDurationMs:     number;
  retryCount:          number;
  processedAt:         string;           // ISO timestamp
  errors:              string[];
  warnings:            string[];
}

// Factory: cria resultado inicial para um evento
export function createEventResult(
  input:    GameEventInput,
  priority: EventPriority
): GameEventResult {
  return {
    eventId:             input.eventId,
    eventType:           input.eventType,
    uid:                 input.uid,
    status:              'PENDING',
    priority,
    eventVersion:        GAME_EVENT_VERSION,
    schemaVersion:       GAME_SCHEMA_VERSION,
    source:              input.source,
    origin:              input.origin,
    dispatcherResults:   [],
    dispatchersExecuted: [],
    dispatchersSkipped:  [],
    totalDurationMs:     0,
    retryCount:          0,
    processedAt:         new Date().toISOString(),
    errors:              [],
    warnings:            [],
  };
}
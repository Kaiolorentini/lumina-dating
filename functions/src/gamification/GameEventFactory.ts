// ============================================
// LUMINA — GAME EVENT FACTORY v1.1
// functions/src/gamification/GameEventFactory.ts
//
// BLOCO 5 — Factory completa:
// eventId, eventHash, schemaVersion, eventVersion,
// correlationId, timestamp, origin, source, metadata.
// Nenhum evento pode ser criado manualmente.
// ============================================

import { GameEventInput, GameEventMeta } from './GameEventContext';
import { GAME_EVENT_VERSION, GAME_SCHEMA_VERSION } from './GameEventTypes';

// Gera eventId único
function newEventId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

// Gera correlationId único
function newCorrelationId(): string {
  return `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// Gera hash determinístico do evento (sem dependência externa)
function buildEventHash(uid: string, eventType: string, targetUid?: string): string {
  const key  = `${uid}|${eventType}|${targetUid ?? ''}|${new Date().toISOString().slice(0, 13)}`;
  let   hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

interface BaseParams {
  uid:          string;
  targetUid?:   string;
  requestId?:   string;
  sessionId?:   string;
  deviceId?:    string;
  appVersion?:  string;
  platform?:    'ios' | 'android' | 'web';
  locale?:      string;
  meta?:        GameEventMeta;
  // Permite override do correlationId (quando vem do Orchestrator)
  correlationId?: string;
}

// Constrói GameEventInput completo — nunca incompleto
function buildEvent(
  params:    BaseParams,
  eventType: GameEventInput['eventType'],
  source:    GameEventInput['source'],
  origin:    GameEventInput['origin']
): GameEventInput {
  const eventId       = newEventId();
  const correlationId = params.correlationId ?? newCorrelationId();
  const eventHash     = buildEventHash(params.uid, eventType, params.targetUid);

  return {
    eventId,
    eventType,
    uid:          params.uid,
    targetUid:    params.targetUid,
    source,
    origin,
    requestId:    params.requestId,
    sessionId:    params.sessionId,
    deviceId:     params.deviceId,
    appVersion:   params.appVersion,
    platform:     params.platform,
    locale:       params.locale,
    meta:         params.meta,
    // Campos extras injetados via meta para rastreabilidade
    // (eventHash e correlationId expostos para o EventLedger via options)
    _eventHash:        eventHash,
    _correlationId:    correlationId,
    _eventVersion:     GAME_EVENT_VERSION,
    _schemaVersion:    GAME_SCHEMA_VERSION,
    _timestamp:        new Date().toISOString(),
  } as GameEventInput & Record<string, unknown>;
}

export const GameEventFactory = {
  profileVisit(p: BaseParams & { targetUid: string }): GameEventInput {
    return buildEvent(p, 'PROFILE_VISIT', 'APP', 'PROFILE');
  },
  profileLike(p: BaseParams & { targetUid: string }): GameEventInput {
    return buildEvent(p, 'PROFILE_LIKE', 'APP', 'PROFILE');
  },
  matchCreated(p: BaseParams & { targetUid: string }): GameEventInput {
    return buildEvent(p, 'MATCH_CREATED', 'FUNCTION', 'MATCH');
  },
  messageReply(p: BaseParams & { targetUid: string; meta: { messageCount: number } }): GameEventInput {
    return buildEvent(p, 'MESSAGE_REPLY', 'APP', 'CHAT');
  },
  missionCompleted(p: BaseParams & { meta: { missionId: string; missionCategory: string } }): GameEventInput {
    return buildEvent(p, 'MISSION_COMPLETED', 'FUNCTION', 'MISSION');
  },
  levelUp(p: BaseParams & { meta: { xpAmount: number } }): GameEventInput {
    return buildEvent(p, 'LEVEL_UP', 'SYSTEM', 'SYSTEM');
  },
  treeEvolution(p: BaseParams & { meta: { treeStage: number } }): GameEventInput {
    return buildEvent(p, 'TREE_EVOLUTION', 'SYSTEM', 'SYSTEM');
  },
  achievementUnlocked(p: BaseParams & { meta: { achievementId: string } }): GameEventInput {
    return buildEvent(p, 'ACHIEVEMENT_UNLOCKED', 'SYSTEM', 'SYSTEM');
  },
  // Reservados para eventos futuros (MELHORIA 9)
  // profileFollow, profileShare, storyView, giftSent, dailyLogin, weeklyStreak
};
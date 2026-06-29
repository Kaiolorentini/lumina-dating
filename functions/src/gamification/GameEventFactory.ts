// ============================================
// LUMINA — GAME EVENT FACTORY v1.0
// functions/src/gamification/GameEventFactory.ts
//
// BLOCO 1 — Fundação (v2)
// Padroniza a criação de eventos.
// Nenhum arquivo cria GameEventInput manualmente.
// MELHORIA 1: EventFactory
// ============================================

import { GameEventInput, GameEventMeta } from './GameEventContext';

// Parâmetros comuns para todos os eventos
interface BaseEventParams {
  uid:          string;
  targetUid?:   string;
  requestId?:   string;
  sessionId?:   string;
  deviceId?:    string;
  appVersion?:  string;
  platform?:    'ios' | 'android' | 'web';
  locale?:      string;
  meta?:        GameEventMeta;
}

// Gera eventId único sem dependência externa
function newEventId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export const GameEventFactory = {

  profileVisit(params: BaseEventParams & { targetUid: string }): GameEventInput {
    return {
      eventId:   newEventId(),
      eventType: 'PROFILE_VISIT',
      source:    'APP',
      origin:    'PROFILE',
      ...params,
    };
  },

  profileLike(params: BaseEventParams & { targetUid: string }): GameEventInput {
    return {
      eventId:   newEventId(),
      eventType: 'PROFILE_LIKE',
      source:    'APP',
      origin:    'PROFILE',
      ...params,
    };
  },

  matchCreated(params: BaseEventParams & { targetUid: string }): GameEventInput {
    return {
      eventId:   newEventId(),
      eventType: 'MATCH_CREATED',
      source:    'FUNCTION',
      origin:    'MATCH',
      ...params,
    };
  },

  messageReply(params: BaseEventParams & { targetUid: string; meta: { messageCount: number } }): GameEventInput {
    return {
      eventId:   newEventId(),
      eventType: 'MESSAGE_REPLY',
      source:    'APP',
      origin:    'CHAT',
      ...params,
    };
  },

  missionCompleted(params: BaseEventParams & { meta: { missionId: string; missionCategory: string } }): GameEventInput {
    return {
      eventId:   newEventId(),
      eventType: 'MISSION_COMPLETED',
      source:    'FUNCTION',
      origin:    'MISSION',
      ...params,
    };
  },

  vaultClaim(params: BaseEventParams & { meta: { vaultFragments: number } }): GameEventInput {
    return {
      eventId:   newEventId(),
      eventType: 'VAULT_CLAIM',
      source:    'APP',
      origin:    'VAULT',
      ...params,
    };
  },

  levelUp(params: BaseEventParams & { meta: { xpAmount: number } }): GameEventInput {
    return {
      eventId:   newEventId(),
      eventType: 'LEVEL_UP',
      source:    'SYSTEM',
      origin:    'SYSTEM',
      ...params,
    };
  },

  treeEvolution(params: BaseEventParams & { meta: { treeStage: number } }): GameEventInput {
    return {
      eventId:   newEventId(),
      eventType: 'TREE_EVOLUTION',
      source:    'SYSTEM',
      origin:    'SYSTEM',
      ...params,
    };
  },

  achievementUnlocked(params: BaseEventParams & { meta: { achievementId: string } }): GameEventInput {
    return {
      eventId:   newEventId(),
      eventType: 'ACHIEVEMENT_UNLOCKED',
      source:    'SYSTEM',
      origin:    'SYSTEM',
      ...params,
    };
  },
};
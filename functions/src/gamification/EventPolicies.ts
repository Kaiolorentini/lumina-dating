// ============================================
// LUMINA — EVENT POLICIES v1.0
// functions/src/gamification/EventPolicies.ts
//
// BLOCO 1 — Fundação (v2)
// Centraliza rate limit, risco e prioridade por evento.
// Sem lógica de negócio.
// ============================================

import { GameEventType, EventPriority } from './GameEventTypes';

export interface EventPolicy {
  priority:          EventPriority;
  riskLevel:         'LOW' | 'MEDIUM' | 'HIGH';
  maxPerMinute:      number;   // rate limit por usuário
  maxPerDay:         number;   // 0 = sem limite
  requiresTargetUid: boolean;  // evento precisa de targetUid
}

// Políticas centralizadas por evento (MELHORIA EventPolicies)
export const EVENT_POLICIES: Record<GameEventType, EventPolicy> = {
  PROFILE_VISIT: {
    priority:          'LOW',
    riskLevel:         'LOW',
    maxPerMinute:      30,
    maxPerDay:         0,
    requiresTargetUid: true,
  },

  PROFILE_LIKE: {
    priority:          'LOW',
    riskLevel:         'LOW',
    maxPerMinute:      20,
    maxPerDay:         0,
    requiresTargetUid: true,
  },

  MATCH_CREATED: {
    priority:          'NORMAL',
    riskLevel:         'LOW',
    maxPerMinute:      10,
    maxPerDay:         0,
    requiresTargetUid: true,
  },

  MESSAGE_REPLY: {
    priority:          'NORMAL',
    riskLevel:         'MEDIUM',
    maxPerMinute:      30,
    maxPerDay:         0,
    requiresTargetUid: true,
  },

  MISSION_COMPLETED: {
    priority:          'NORMAL',
    riskLevel:         'LOW',
    maxPerMinute:      10,
    maxPerDay:         0,
    requiresTargetUid: false,
  },

  VAULT_CLAIM: {
    priority:          'NORMAL',
    riskLevel:         'LOW',
    maxPerMinute:      5,
    maxPerDay:         10,
    requiresTargetUid: false,
  },

  LEVEL_UP: {
    priority:          'HIGH',
    riskLevel:         'LOW',
    maxPerMinute:      5,
    maxPerDay:         0,
    requiresTargetUid: false,
  },

  TREE_EVOLUTION: {
    priority:          'HIGH',
    riskLevel:         'LOW',
    maxPerMinute:      5,
    maxPerDay:         0,
    requiresTargetUid: false,
  },

  ACHIEVEMENT_UNLOCKED: {
    priority:          'HIGH',
    riskLevel:         'LOW',
    maxPerMinute:      10,
    maxPerDay:         0,
    requiresTargetUid: false,
  },
};

// Helper: retorna a política de um evento
export function getPolicyForEvent(eventType: GameEventType): EventPolicy {
  return EVENT_POLICIES[eventType];
}
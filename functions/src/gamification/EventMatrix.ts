// ============================================
// LUMINA — EVENT MATRIX v1.1
// functions/src/gamification/EventMatrix.ts
//
// BLOCO 1 — Fundação (v2)
// Única fonte de verdade sobre quais dispatchers
// são executados por evento. Sem lógica de negócio.
// ============================================

import { GameEventType, DispatcherType } from './GameEventTypes';

// Matriz: evento → dispatchers (em ordem de execução)
export const EVENT_MATRIX: Record<GameEventType, DispatcherType[]> = {
  PROFILE_VISIT: [
    'VAULT',
    'XP',
    'MISSION',
    'ACHIEVEMENT',
    'RANKING',
    'ANALYTICS',
  ],

  PROFILE_LIKE: [
    'VAULT',
    'XP',
    'MISSION',
    'ACHIEVEMENT',
    'RANKING',
    'ANALYTICS',
  ],

  MATCH_CREATED: [
    'VAULT',
    'XP',
    'TREE',
    'ACHIEVEMENT',
    'RANKING',
    'PRESTIGE',
    'ANALYTICS',
  ],

  MESSAGE_REPLY: [
    'XP',
    'MISSION',
    'ACHIEVEMENT',
    'RANKING',
    'ANALYTICS',
  ],

  MISSION_COMPLETED: [
    'XP',
    'ACHIEVEMENT',
    'RANKING',
    'ANALYTICS',
  ],

  VAULT_CLAIM: [
    'ACHIEVEMENT',
    'ANALYTICS',
  ],

  LEVEL_UP: [
    'NOTIFICATION',
    'ACHIEVEMENT',
    'ANALYTICS',
  ],

  TREE_EVOLUTION: [
    'ACHIEVEMENT',
    'PRESTIGE',
    'NOTIFICATION',
    'ANALYTICS',
  ],

  ACHIEVEMENT_UNLOCKED: [
    'NOTIFICATION',
    'ANALYTICS',
  ],
};

// Helper: retorna dispatchers para um evento
export function getDispatchersForEvent(eventType: GameEventType): DispatcherType[] {
  return EVENT_MATRIX[eventType] ?? [];
}
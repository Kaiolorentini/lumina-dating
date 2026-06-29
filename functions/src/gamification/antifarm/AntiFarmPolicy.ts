// ============================================
// LUMINA — ANTI FARM POLICY v1.0
// functions/src/gamification/antifarm/AntiFarmPolicy.ts
//
// BLOCO 5 — Regras anti-farm centralizadas.
// Alterar aqui sem tocar no AntiFarmService.
// ============================================

import { GameEventType } from '../GameEventTypes';

export type AntiFarmDecision = 'ALLOW' | 'LIMIT' | 'BLOCK';

export interface AntiFarmPolicy {
  maxPerDay:         number;  // máx ações únicas/dia (0 = sem limite)
  maxPerMinute:      number;  // rate limit por minuto
  perTargetCooldown: boolean; // 1x por targetUid/dia
  collectionPath:    string;  // Firestore collection de controle
}

// Políticas por evento — única fonte de verdade anti-farm
export const ANTI_FARM_POLICIES: Partial<Record<GameEventType, AntiFarmPolicy>> = {
  PROFILE_VISIT: {
    maxPerDay:         50,
    maxPerMinute:      30,
    perTargetCooldown: true,
    collectionPath:    'visitFarmControl',
  },
  PROFILE_LIKE: {
    maxPerDay:         100,
    maxPerMinute:      20,
    perTargetCooldown: true,
    collectionPath:    'likeFarmControl',
  },
  MESSAGE_REPLY: {
    maxPerDay:         0,    // sem limite diário
    maxPerMinute:      30,
    perTargetCooldown: false,
    collectionPath:    'messageFarmControl',
  },
  MATCH_CREATED: {
    maxPerDay:         0,
    maxPerMinute:      10,
    perTargetCooldown: true,
    collectionPath:    'matchFarmControl',
  },
  MISSION_COMPLETED: {
    maxPerDay:         0,
    maxPerMinute:      10,
    perTargetCooldown: false,
    collectionPath:    'missionFarmControl',
  },
};

export function getPolicyForFarm(eventType: GameEventType): AntiFarmPolicy | undefined {
  return ANTI_FARM_POLICIES[eventType];
}
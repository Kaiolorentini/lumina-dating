// ============================================
// LUMINA — SHADOW STATUS v2.0
// functions/src/gamification/shadow/ShadowStatus.ts
//
// SPRINT 1C — v2.0: adiciona INHERITED para Tree.
// ============================================

export enum ShadowStatus {
  MATCH         = 'MATCH',
  DIFFERENT     = 'DIFFERENT',
  ERROR         = 'ERROR',
  INHERITED     = 'INHERITED',     // coberto indiretamente (Tree via XP)
  NOT_SUPPORTED = 'NOT_SUPPORTED', // modelo incompatível nesta Sprint (Prestige)
}

export type ShadowSystem = 'XP' | 'RANKING' | 'ACHIEVEMENT' | 'VAULT' | 'TREE' | 'PRESTIGE';

export enum DivergenceSeverity {
  NONE     = 'NONE',
  LOW      = 'LOW',
  MEDIUM   = 'MEDIUM',
  CRITICAL = 'CRITICAL',
}
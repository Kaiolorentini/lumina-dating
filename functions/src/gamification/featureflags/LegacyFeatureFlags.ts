// ============================================
// LUMINA — LEGACY FEATURE FLAGS v1.1
// functions/src/gamification/featureflags/LegacyFeatureFlags.ts
//
// SPRINT 0/1A — Flags por sistema para controlar
// transição Legacy → Engine sem deploy (rollback em segundos).
// v1.1: adiciona TREE e PRESTIGE como sistemas próprios.
// ============================================

import * as admin from 'firebase-admin';

const db = admin.firestore();

export type LegacySystem = 'XP' | 'RANKING' | 'ACHIEVEMENT' | 'VAULT' | 'TREE' | 'PRESTIGE';

export interface LegacyFlagsState {
  LegacyXP:          boolean;
  LegacyRanking:      boolean;
  LegacyAchievement:  boolean;
  LegacyVault:        boolean;
  LegacyTree:         boolean;
  LegacyPrestige:     boolean;
  ShadowModeEnabled:  boolean;
  CanaryPercentage:   number;
}

const DEFAULTS: LegacyFlagsState = {
  LegacyXP:          true,
  LegacyRanking:      true,
  LegacyAchievement:  true,
  LegacyVault:        true,
  LegacyTree:         true,
  LegacyPrestige:     true,
  ShadowModeEnabled:  false,
  CanaryPercentage:   0,
};

let cache: { state: LegacyFlagsState; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export const LegacyFeatureFlags = {
  async getState(): Promise<LegacyFlagsState> {
    if (cache && cache.expiresAt > Date.now()) {
      return cache.state;
    }

    const doc = await db.collection('systemConfig').doc('legacyFlags').get();
    const state: LegacyFlagsState = doc.exists
      ? { ...DEFAULTS, ...doc.data() } as LegacyFlagsState
      : DEFAULTS;

    cache = { state, expiresAt: Date.now() + CACHE_TTL_MS };
    return state;
  },

  async isUserInCanary(uid: string): Promise<boolean> {
    const state = await this.getState();
    if (state.CanaryPercentage >= 100) return true;
    if (state.CanaryPercentage <= 0)   return false;

    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = ((hash << 5) - hash) + uid.charCodeAt(i);
      hash |= 0;
    }
    const bucket = Math.abs(hash) % 100;
    return bucket < state.CanaryPercentage;
  },

  async setState(partial: Partial<LegacyFlagsState>): Promise<void> {
    await db.collection('systemConfig').doc('legacyFlags').set(partial, { merge: true });
    cache = null;
  },
};
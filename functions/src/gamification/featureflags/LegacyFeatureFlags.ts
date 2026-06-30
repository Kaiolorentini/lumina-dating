// ============================================
// LUMINA — LEGACY FEATURE FLAGS v1.0
// functions/src/gamification/featureflags/LegacyFeatureFlags.ts
//
// SPRINT 0 — Flags por sistema para controlar
// transição Legacy → Engine sem deploy (rollback em segundos).
// Lidas do Firestore para permitir toggle em runtime.
// ============================================

import * as admin from 'firebase-admin';

const db = admin.firestore();

export type LegacySystem = 'XP' | 'RANKING' | 'ACHIEVEMENT' | 'VAULT';

export interface LegacyFlagsState {
  LegacyXP:          boolean; // true = legado ainda produz efeito real
  LegacyRanking:      boolean;
  LegacyAchievement:  boolean;
  LegacyVault:        boolean;
  ShadowModeEnabled:  boolean; // true = Engine roda em paralelo só comparando
  CanaryPercentage:   number;  // 0-100 — % de usuários no Engine ativo
}

const DEFAULTS: LegacyFlagsState = {
  LegacyXP:          true,
  LegacyRanking:      true,
  LegacyAchievement:  true,
  LegacyVault:        true,
  ShadowModeEnabled:  false,
  CanaryPercentage:   0,
};

let cache: { state: LegacyFlagsState; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000; // 30s — flags não precisam ser real-time

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

  // Verifica se um usuário específico está no grupo Canary (Engine ativo)
  async isUserInCanary(uid: string): Promise<boolean> {
    const state = await this.getState();
    if (state.CanaryPercentage >= 100) return true;
    if (state.CanaryPercentage <= 0)   return false;

    // Hash determinístico do uid → 0-99
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = ((hash << 5) - hash) + uid.charCodeAt(i);
      hash |= 0;
    }
    const bucket = Math.abs(hash) % 100;
    return bucket < state.CanaryPercentage;
  },

  // Define flags — chamado via painel admin
  async setState(partial: Partial<LegacyFlagsState>): Promise<void> {
    await db.collection('systemConfig').doc('legacyFlags').set(partial, { merge: true });
    cache = null; // invalida cache imediatamente
  },
};
// ============================================
// LUMINA — ECONOMY CONFIG DINÂMICA
// functions/src/config/economyConfig.ts
// ============================================

import * as admin from 'firebase-admin';
import { COSTS, REWARDS, DAILY_LIMITS } from './economy';

export interface EconomyConfig {
  loginRewardBase:     number;
  loginRewardMax:      number;
  faiskaMultiplier:    number;
  revealVisitorsCost:  number;
  quaseSintoniaCost:   number;
  sintoniaPerdidaCost: number;
  mysteryMatchCost:    number;
  pensouEmVoceCost:    number;
  impulsoCost:         number;
  dailyGratuitosCap:   number;
  monthlyGratuitosCap: number;
  xpFromLikesCap:      number;
  activeEvent:         string | null;
  eventMultiplier:     number;
  eventExpiresAt:      admin.firestore.Timestamp | null;
  rankingEnabled:      boolean;
  vaultEnabled:        boolean;
  galaxiaPlusEnabled:  boolean;
}

const DEFAULT_CONFIG: EconomyConfig = {
  loginRewardBase:     REWARDS.LOGIN_BASE,
  loginRewardMax:      REWARDS.LOGIN_MAX,
  faiskaMultiplier:    1.0,
  revealVisitorsCost:  COSTS.REVEAL_VISITORS,
  quaseSintoniaCost:   COSTS.REVEAL_QUASE_SINTONIA,
  sintoniaPerdidaCost: COSTS.REVEAL_SINTONIA_PERDIDA,
  mysteryMatchCost:    COSTS.REVEAL_MYSTERY_MATCH,
  pensouEmVoceCost:    COSTS.REVEAL_PENSOU_EM_VOCE,
  impulsoCost:         COSTS.IMPULSO_PERFIL,
  dailyGratuitosCap:   DAILY_LIMITS.CRYSTALS_GRATUITOS_MAX,
  monthlyGratuitosCap: DAILY_LIMITS.CRYSTALS_GRATUITOS_MONTHLY_MAX,
  xpFromLikesCap:      DAILY_LIMITS.XP_FROM_LIKES_MAX,
  activeEvent:         null,
  eventMultiplier:     1.0,
  eventExpiresAt:      null,
  rankingEnabled:      true,
  vaultEnabled:        true,
  galaxiaPlusEnabled:  true,
};

let cachedConfig:   EconomyConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getEconomyConfig(): Promise<EconomyConfig> {
  const now = Date.now();

  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const db   = admin.firestore();
    const snap = await db.collection('config').doc('economy').get();

    // Admin SDK: .exists é propriedade booleana — sem parênteses
    if (!snap.exists) {
      cachedConfig   = DEFAULT_CONFIG;
      cacheTimestamp = now;
      return DEFAULT_CONFIG;
    }

    const data   = snap.data()!;
    cachedConfig = { ...DEFAULT_CONFIG, ...data } as EconomyConfig;

    if (cachedConfig.eventExpiresAt) {
      const expires = cachedConfig.eventExpiresAt.toMillis();
      if (now > expires) {
        cachedConfig.activeEvent     = null;
        cachedConfig.eventMultiplier = 1.0;
        db.collection('config').doc('economy').update({
          activeEvent:     null,
          eventMultiplier: 1.0,
          eventExpiresAt:  null,
        }).catch(console.error);
      }
    }

    cacheTimestamp = now;
    return cachedConfig;

  } catch (error: unknown) {
    console.error('[economyConfig] Erro ao buscar config — usando defaults:', error);
    return DEFAULT_CONFIG;
  }
}

export function invalidateEconomyConfigCache(): void {
  cachedConfig   = null;
  cacheTimestamp = 0;
}

export const INITIAL_ECONOMY_CONFIG_DOC = {
  loginRewardBase:     5,
  loginRewardMax:      10,
  faiskaMultiplier:    1.0,
  revealVisitorsCost:  50,
  quaseSintoniaCost:   25,
  sintoniaPerdidaCost: 35,
  mysteryMatchCost:    30,
  pensouEmVoceCost:    20,
  impulsoCost:         80,
  dailyGratuitosCap:   40,
  monthlyGratuitosCap: 800,
  xpFromLikesCap:      100,
  activeEvent:         null,
  eventMultiplier:     1.0,
  eventExpiresAt:      null,
  rankingEnabled:      true,
  vaultEnabled:        true,
  galaxiaPlusEnabled:  true,
  updatedAt:           admin.firestore.FieldValue.serverTimestamp(),
};
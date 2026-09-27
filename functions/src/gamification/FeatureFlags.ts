// ============================================
// LUMINA — GAMIFICATION FEATURE FLAGS v1.1
// functions/src/gamification/FeatureFlags.ts
//
// BLOCO 1 — Fundação (v2)
// Controla quais sistemas estão ativos server-side.
// Sem publicar nova versão do app.
// ============================================

import { DispatcherType } from './GameEventTypes';

// Engine principal
export const GAMIFICATION_ENGINE_ENABLED = true;

// Middleware flags
export const MIDDLEWARE_FLAGS = {
  VALIDATION:   true,
  RISK:         true,
  IDEMPOTENCY:  true,
  FEATURE_FLAG: true,
  ANALYTICS:    true,
  LOGGING:      true,
};

// Dispatcher flags
//
// TREE, ACHIEVEMENT e PRESTIGE DESLIGADOS (v1.2).
// Nunca foram registrados (registerDispatchers.ts não os
// importa) e cada um precisa de reescrita do Service, não de
// um import:
//   TREE        — conflita com o XP (treeXP com constante
//                 própria) e grava estágio sem gravar treeXP.
//                 A árvore vive no XPService.
//   ACHIEVEMENT — o persist não entrega recompensa e duplicaria
//                 o achievementTriggers, que é o fluxo vivo.
//   PRESTIGE    — aponta para o Service antigo em
//                 gamification/services/. O vivo é
//                 engagement/prestigeService.ts.
//
// Ligados na matriz e ausentes do registry, voltavam FAILED e
// marcavam TODO evento como FAILED no eventLedger e no
// gamificationAnalytics, mesmo com XP, Vault e Ranking certos.
// Desligados aqui, voltam DISABLED e entram em `skipped`.
//
// Para religar um deles: reescrever o Service, importar o
// dispatcher em registerDispatchers.ts e só então pôr true.
export const DISPATCHER_FLAGS: Record<DispatcherType, boolean> = {
  XP:           true,
  VAULT:        true,
  ACHIEVEMENT:  false,
  MISSION:      true,
  RANKING:      true,
  TREE:         false,
  PRESTIGE:     false,
  NOTIFICATION: true,
  ANALYTICS:    true,
};

// Helper: verifica se um dispatcher está habilitado
export function isDispatcherEnabled(dispatcher: DispatcherType): boolean {
  return GAMIFICATION_ENGINE_ENABLED && (DISPATCHER_FLAGS[dispatcher] ?? false);
}

// Helper: verifica se um middleware está habilitado
export function isMiddlewareEnabled(key: keyof typeof MIDDLEWARE_FLAGS): boolean {
  return GAMIFICATION_ENGINE_ENABLED && (MIDDLEWARE_FLAGS[key] ?? false);
}
// ============================================
// LUMINA — COMPATIBILIDADE (SERVIDOR)
// functions/src/utils/compatibility.ts
//
// 12/10/2026 — SINTONIA v2: este arquivo virou uma camada fina sobre
// config/sintoniaFormula.ts, a FONTE ÚNICA, idêntica à do app. Antes
// o servidor tinha uma fórmula própria (30 a 99, sem interesses nem
// foto) e o push dizia um número enquanto o perfil mostrava outro.
// Agora a Carta do Destino, a Quase Sintonia (85+) e a Sintonia
// Perdida usam o mesmo número que a pessoa vê no app.
//
// Os nomes antigos continuam exportados para não mudar quem importa
// (destinyCard.ts e EmotionalTriggersService.ts).
// ============================================

import {
  PREFERENCE_TO_GENDERS as FORMULA_PREFERENCE_TO_GENDERS,
  computeSintonia,
  seeksFromPreferences,
} from '../config/sintoniaFormula';

export const PREFERENCE_TO_GENDERS = FORMULA_PREFERENCE_TO_GENDERS;

/** Gêneros cobertos pela lista de preferências. */
export function gendersFromPreferences(preferences: string[]): string[] {
  return seeksFromPreferences(preferences);
}

/** Sintonia v2 (0 a 100), igual para os dois lados. */
export function calcCompatibilidade(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  return computeSintonia(a, b).score;
}

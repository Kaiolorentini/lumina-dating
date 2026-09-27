// ============================================
// LUMINA — COMPATIBILIDADE (SERVIDOR)
// functions/src/utils/compatibility.ts
//
// Fonte ÚNICA do cálculo de Sintonia no servidor, usada pela
// Carta do Destino e pelos gatilhos emocionais. Antes cada um
// tinha a sua cópia — e a dos gatilhos comparava a preferência
// ("mulheres") direto com o gênero ("feminino"). Nunca casava, a
// nota máxima ficava em 70, e a Quase Sintonia (85+) NUNCA
// disparava.
//
// DÍVIDA: o cálculo do app (sintoniaEngine) considera interesses
// e bio, e este não. A tela recalcula no app o número exibido.
// ============================================

/**
 * Preferência → gêneros que ela cobre. Os dois campos usam
 * VOCABULÁRIOS DIFERENTES: preferência é 'homens'|'mulheres'|
 * 'trans'|'todos'; gênero é 'masculino'|'feminino'|'trans'|
 * 'nao-binario'.
 */
export const PREFERENCE_TO_GENDERS: Record<string, string[]> = {
  homens:   ['masculino'],
  mulheres: ['feminino'],
  trans:    ['trans'],
  todos:    ['masculino', 'feminino', 'trans', 'nao-binario'],
};

export function gendersFromPreferences(preferences: string[]): string[] {
  const set = new Set<string>();
  for (const pref of preferences) {
    for (const g of PREFERENCE_TO_GENDERS[pref] ?? []) set.add(g);
  }
  return [...set];
}

/**
 * Compatibilidade de 30 a 99, do ponto de vista de `a`.
 * Máximo teórico: 45 + 20 + 15 + 12 + 10 = 102 → 99.
 */
export function calcCompatibilidade(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  let score = 45;

  const prefA = (a.preferences as string[] | undefined) ?? [];
  const prefB = (b.preferences as string[] | undefined) ?? [];

  if (gendersFromPreferences(prefA).includes(b.gender as string)) score += 20;
  if (gendersFromPreferences(prefB).includes(a.gender as string)) score += 15;

  const ageA = (a.age as number | undefined) ?? 25;
  const ageB = (b.age as number | undefined) ?? 25;
  const ageDiff = Math.abs(ageA - ageB);
  if (ageDiff <= 3)       score += 12;
  else if (ageDiff <= 7)  score += 7;
  else if (ageDiff <= 12) score += 3;

  if (a.regiaoId && b.regiaoId && a.regiaoId === b.regiaoId) score += 10;
  else if (a.state && b.state && a.state === b.state) score += 4;

  return Math.min(Math.max(score, 30), 99);
}
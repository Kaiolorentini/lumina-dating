// ============================================
// LUMINA — SINTONIA v2 (APP)
// src/config/sintonia/sintoniaFormula.ts
//
// ESPELHO IDÊNTICO de functions/src/config/sintoniaFormula.ts
// (12/10/2026). Os dois saem da mesma fonte e um teste confere que
// dão o mesmo número.
// Ao mudar: troque nos dois, suba SINTONIA_FORMULA_VERSION e faça o
// deploy das functions antes do eas update.
// Sem imports e sem Firebase: função pura.
// ============================================

export const SINTONIA_FORMULA_VERSION = 2;

/** Sem interesse dos DOIS lados, a Sintonia fica no máximo aqui. */
export const SINTONIA_NON_MUTUAL_CAP = 35;

/** Nota neutra quando falta gênero de um dos dois (perfil incompleto). */
export const SINTONIA_NEUTRAL_SCORE = 50;

/** Pontos máximos de cada bloco. */
export const SINTONIA_WEIGHTS = {
  interesseMutuo: 40,
  idade: 20,
  localizacao: 20,
  interesses: 20,
} as const;

/** Cada interesse em comum vale isto, até o máximo do bloco. */
export const POINTS_PER_COMMON_INTEREST = 7;

/**
 * Quando um dos dois ainda não escolheu interesses, o bloco vale o
 * mesmo que 1 interesse em comum. Se ficasse de fora, NÃO escolher
 * interesses daria nota maior do que escolher — incentivo errado.
 */
export const NEUTRAL_INTEREST_POINTS = POINTS_PER_COMMON_INTEREST;

/** Máximo de interesses por perfil. */
export const MAX_INTERESTS = 10;

/**
 * Preferência → gêneros que ela cobre. Os dois campos usam
 * vocabulários diferentes: preferência é 'homens' | 'mulheres' |
 * 'trans' | 'todos'; gênero é 'masculino' | 'feminino' | 'trans' |
 * 'nao-binario'.
 */
export const PREFERENCE_TO_GENDERS: Record<string, readonly string[]> = {
  homens:   ['masculino'],
  mulheres: ['feminino'],
  trans:    ['trans'],
  todos:    ['masculino', 'feminino', 'trans', 'nao-binario'],
};

/** Gêneros pelos quais a pessoa se interessa (sem repetição, ordem fixa). */
export function seeksFromPreferences(preferences: unknown): string[] {
  const out: string[] = [];
  if (!Array.isArray(preferences)) return out;
  for (const pref of preferences) {
    for (const gender of PREFERENCE_TO_GENDERS[String(pref)] ?? []) {
      if (!out.includes(gender)) out.push(gender);
    }
  }
  return ['masculino', 'feminino', 'trans', 'nao-binario'].filter(g => out.includes(g));
}

/** Campos do perfil que a Sintonia usa. Serve para users e publicProfiles. */
export interface SintoniaProfile {
  gender?: unknown;
  preferences?: unknown;
  age?: unknown;
  regiaoId?: unknown;
  estadoId?: unknown;
  state?: unknown;
  city?: unknown;
  interests?: unknown;
}

export type MutualInterest = 'both' | 'one' | 'none';

export interface SintoniaParts {
  /** Interesse mútuo: os dois, só um, nenhum. */
  mutual: MutualInterest;
  interesseMutuo: number;
  idade: number;
  localizacao: number;
  interesses: number;
  /** false quando um dos dois ainda não escolheu interesses (vale o neutro). */
  interestsKnown: boolean;
  /** Interesses que os dois marcaram. */
  commonInterests: string[];
  /** true quando a nota foi limitada por falta de interesse mútuo. */
  capped: boolean;
}

export interface SintoniaComputation {
  /** 0 a 100. É o MESMO número para os dois lados. */
  score: number;
  parts: SintoniaParts;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validAge(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 18 && value <= 120 ? value : null;
}

function interestList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item && !out.includes(item)) out.push(item);
    if (out.length >= MAX_INTERESTS) break;
  }
  return out;
}

function mutualOf(a: SintoniaProfile, b: SintoniaProfile): MutualInterest {
  const aLikesB = seeksFromPreferences(a.preferences).includes(String(b.gender));
  const bLikesA = seeksFromPreferences(b.preferences).includes(String(a.gender));
  if (aLikesB && bLikesA) return 'both';
  if (aLikesB || bLikesA) return 'one';
  return 'none';
}

function agePoints(a: unknown, b: unknown): number {
  const ageA = validAge(a);
  const ageB = validAge(b);
  if (ageA === null || ageB === null) return 10;
  const diff = Math.abs(ageA - ageB);
  if (diff <= 2) return 20;
  if (diff <= 4) return 17;
  if (diff <= 6) return 14;
  if (diff <= 9) return 10;
  if (diff <= 13) return 6;
  return 2;
}

function locationPoints(a: SintoniaProfile, b: SintoniaProfile): number {
  const regA = text(a.regiaoId);
  const regB = text(b.regiaoId);
  if (regA && regB) {
    if (regA === regB) return 20;
  } else if (text(a.city) && text(a.city) === text(b.city) && text(a.state) && text(a.state) === text(b.state)) {
    // Perfil antigo, sem código IBGE: compara o nome da cidade.
    return 20;
  }
  const sameState =
    (typeof a.estadoId === 'number' && a.estadoId === b.estadoId) ||
    (!!text(a.state) && text(a.state) === text(b.state));
  if (sameState) return 12;
  const known = (regA || text(a.state)) && (regB || text(b.state));
  return known ? 4 : 8;
}

/**
 * Sintonia v2 — SIMÉTRICA (A com B = B com A).
 *
 * Blocos (somam 100): interesse mútuo 40 · idade 20 ·
 * localização 20 · interesses em comum 20 (7 por interesse em comum;
 * se um dos dois não escolheu, vale 7). Sem interesse dos dois lados,
 * a nota fica no máximo em SINTONIA_NON_MUTUAL_CAP.
 */
export function computeSintonia(a: SintoniaProfile, b: SintoniaProfile): SintoniaComputation {
  if (!text(a.gender) || !text(b.gender)) {
    return {
      score: SINTONIA_NEUTRAL_SCORE,
      parts: {
        mutual: 'none', interesseMutuo: 0, idade: 0, localizacao: 0,
        interesses: 0, interestsKnown: false, commonInterests: [], capped: false,
      },
    };
  }

  const mutual = mutualOf(a, b);
  const interesseMutuo = mutual === 'both' ? SINTONIA_WEIGHTS.interesseMutuo : mutual === 'one' ? 12 : 0;
  const idade = agePoints(a.age, b.age);
  const localizacao = locationPoints(a, b);

  const listA = interestList(a.interests);
  const listB = interestList(b.interests);
  const commonInterests = listA.filter(item => listB.includes(item));
  const interestsKnown = listA.length > 0 && listB.length > 0;
  const interesses = interestsKnown
    ? Math.min(SINTONIA_WEIGHTS.interesses, commonInterests.length * POINTS_PER_COMMON_INTEREST)
    : NEUTRAL_INTEREST_POINTS;

  // Os pesos somam 100: a nota é a soma dos pontos.
  let score = interesseMutuo + idade + localizacao + interesses;
  let capped = false;
  if (mutual !== 'both' && score > SINTONIA_NON_MUTUAL_CAP) {
    score = SINTONIA_NON_MUTUAL_CAP;
    capped = true;
  }
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    parts: { mutual, interesseMutuo, idade, localizacao, interesses, interestsKnown, commonInterests, capped },
  };
}

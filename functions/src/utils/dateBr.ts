// ============================================
// LUMINA — DATA BRT v1.0
// functions/src/utils/dateBr.ts
//
// Fonte única de verdade para chaves de dia.
//
// toISOString() devolve UTC. Entre 21h e meia-noite BRT o dia
// já virou para o UTC, e todo contador diário — XP, fragmentos,
// anti-farm, streak — zerava três horas antes da hora.
//
// Use SOMENTE para chaves de dia/mês (limites diários,
// idempotência por data, streak). Para instantes absolutos
// (expiresAt, timestamps de log) toISOString() continua certo.
// ============================================

const TZ = 'America/Sao_Paulo';

// YYYY-MM-DD no fuso de Brasília.
export function todayBr(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

// YYYY-MM no fuso de Brasília.
export function monthBr(date: Date = new Date()): string {
  return todayBr(date).slice(0, 7);
}

// Dia anterior em BRT — para validação de streak.
export function yesterdayBr(date: Date = new Date()): string {
  const d = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return todayBr(d);
}
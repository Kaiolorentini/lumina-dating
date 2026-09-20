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

// ============================================
// SEMANA E TEMPORADA — BRT
//
// O cálculo antigo usava `Math.ceil((getDate() - getDay() + 1) / 7)`,
// que é o dia DO MÊS: gerava W01..W05 repetindo TODO MÊS. A
// primeira semana de fevereiro escrevia no mesmo documento da
// primeira de janeiro, o socialXP do mês anterior continuava lá,
// e o rewardRanking procurava um snapshot com id que não batia
// com o que o freezeRanking tinha gravado — o top 10 nunca era
// pago.
//
// Agora é a semana ISO do ANO, com segunda como primeiro dia,
// calculada em BRT. Em UTC a semana virava domingo às 21h.
// ============================================

/** Data atual em America/Sao_Paulo, como objeto Date local. */
function nowBr(): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  );
}

/**
 * Id da semana no formato AAAA_Wnn, semana ISO 8601.
 * A semana começa na SEGUNDA e a semana 1 é a que contém a
 * primeira quinta-feira do ano.
 */
export function weekIdBr(date: Date = nowBr()): string {
  // Cópia para não mutar o parâmetro.
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // ISO: quinta-feira da mesma semana define o ano.
  // getDay() devolve 0 para domingo; convertemos para 7.
  const dayNum = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() + 4 - dayNum);

  const isoYear = d.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  const firstDayNum = firstThursday.getDay() === 0 ? 7 : firstThursday.getDay();
  firstThursday.setDate(firstThursday.getDate() + 4 - firstDayNum);

  const week = 1 + Math.round(
    (d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000)
  );

  return `${isoYear}_W${String(week).padStart(2, '0')}`;
}

/** Id da semana ANTERIOR — usado pelo rewardRanking. */
export function lastWeekIdBr(): string {
  const d = nowBr();
  d.setDate(d.getDate() - 7);
  return weekIdBr(d);
}

/**
 * Id da temporada, AAAA_Tn com n de 1 a 4.
 * O cálculo antigo usava Math.ceil(getMonth() / 3), e como
 * getMonth() é zero-based, janeiro dava T0.
 */
export function seasonIdBr(date: Date = nowBr()): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `S${date.getFullYear()}_T${quarter}`;
}
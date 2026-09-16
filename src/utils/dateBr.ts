// ============================================
// LUMINA — DATA BRT (CLIENTE)
// src/utils/dateBr.ts
//
// Espelho de functions/src/utils/dateBr.ts. Toda chave de dia
// montada no cliente precisa bater caractere a caractere com a
// que o backend calcula — missionId, likeId, idempotencyKey.
//
// Antes, cinco arquivos repetiam a mesma expressão inline. Foi
// assim que a divergência UTC/BRT nasceu e passou despercebida.
// ============================================

const TZ = 'America/Sao_Paulo';

// YYYY-MM-DD no fuso de Brasília.
export function todayBr(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

// YYYY_MM_DD — formato usado nos ids de missão diária.
export function todayBrUnderscore(date: Date = new Date()): string {
  return todayBr(date).replace(/-/g, '_');
}
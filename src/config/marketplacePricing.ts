// ============================================
// LUMINA — PREÇOS DO MARKETPLACE (app)
// src/config/marketplacePricing.ts
//
// Decisão de Kaio (09/10/2026): produto PAGO custa no mínimo
// R$ 19,99; grátis (R$ 0) continua permitido.
// O servidor e as regras do Firestore conferem de novo — este
// arquivo só serve para avisar o criador antes de enviar.
// MESMO VALOR em functions/src/config/marketplacePricing.ts e
// firestore.rules.
// ============================================

export const MIN_PAID_PRODUCT_PRICE = 19.99;
export const MIN_PAID_PRODUCT_PRICE_LABEL = 'R$ 19,99';

/** Parte do criador em cada venda (o Lumina fica com 20%). */
export const CREATOR_SHARE = 0.8;

/** "29,90" ou "29.90" → 29.9; texto inválido → NaN. */
export function parsePriceInput(text: string): number {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return Number(normalized);
}

export function formatBRLPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

/** Mensagem de erro do preço, ou null se estiver ok. */
export function priceError(isFree: boolean, text: string): string | null {
  if (isFree) return null;
  const value = parsePriceInput(text);
  if (Number.isNaN(value) || value <= 0) {
    return 'Informe um preço válido, por exemplo 29,90 — ou marque como gratuito.';
  }
  if (value < MIN_PAID_PRODUCT_PRICE) {
    return `O preço mínimo é ${MIN_PAID_PRODUCT_PRICE_LABEL}. Para valores menores, marque o produto como gratuito.`;
  }
  return null;
}

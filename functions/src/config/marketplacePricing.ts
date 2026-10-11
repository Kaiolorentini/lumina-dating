// ============================================
// LUMINA — PREÇOS DO MARKETPLACE (servidor)
// functions/src/config/marketplacePricing.ts
//
// Decisão de Kaio (09/10/2026): produto PAGO custa no mínimo
// R$ 19,99. Produto grátis (R$ 0) continua permitido — não passa
// pelo Asaas e não tem taxa.
//
// Motivo: cada Pix recebido custa R$ 1,99 no Asaas. Com 20% de
// comissão, abaixo de ~R$ 10 cada venda dava prejuízo; R$ 19,99
// garante ao menos R$ 2,01 para o Lumina e R$ 15,99 ao criador.
//
// MESMO VALOR em: src/config/marketplacePricing.ts (app) e
// firestore.rules (create/update de products).
// ============================================

export const MIN_PAID_PRODUCT_PRICE = 19.99;

/** Produto pago abaixo do mínimo? (grátis nunca é.) */
export function isBelowMinimumPrice(price: unknown): boolean {
  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) return false;
  return value < MIN_PAID_PRODUCT_PRICE;
}

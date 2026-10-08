// ============================================
// LUMINA — FORMATAÇÃO DE NOTAS DE PRODUTO
// src/shared/utils/rating.ts
//
// Um lugar só para "★ 4,8 (12)", "Novo" e "12 avaliações":
// card, carrossel de destaques e detalhe do produto mostram a
// nota do mesmo jeito. Média e contagem vêm do próprio produto
// (gravadas pela CF submitProductReview) — nenhuma leitura extra.
// ============================================

interface Rated {
  averageRating?: number | null;
  reviewsCount?: number | null;
}

/** Quantidade válida de avaliações (documentos antigos podem não ter o campo). */
export function ratingCount(p: Rated): number {
  const n = Number(p.reviewsCount ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Média com uma casa e vírgula: 4.75 → "4,8". */
export function formatRating(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0;
  return safe.toFixed(1).replace('.', ',');
}

/** "1 avaliação" / "12 avaliações". */
export function reviewsLabel(count: number): string {
  return count === 1 ? '1 avaliação' : `${count.toLocaleString('pt-BR')} avaliações`;
}

/** Texto curto do card: "★ 4,8 (12)" ou "Novo" sem avaliações. */
export function ratingShort(p: Rated): string {
  const count = ratingCount(p);
  if (count === 0) return 'Novo';
  return `★ ${formatRating(p.averageRating)} (${count.toLocaleString('pt-BR')})`;
}

/** Rótulo para leitor de tela. */
export function ratingA11y(p: Rated): string {
  const count = ratingCount(p);
  if (count === 0) return 'Produto novo, ainda sem avaliações';
  return `Nota ${formatRating(p.averageRating)} de 5, ${reviewsLabel(count)}`;
}

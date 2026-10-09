// ============================================
// LUMINA — RESUMO DO CRIADOR (leitura)
// src/services/marketplace/creatorStatsService.ts
//
// Lê creatorStats/{uid}, gravado SÓ pelo servidor
// (functions/src/creators/creatorStats.ts). Uma leitura por
// abertura do painel e uma por venda/avaliação nova — nunca soma
// vendas no celular.
//
// A regra deixa ler só o dono e o admin.
// ============================================

import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../core/firebase';

export interface CreatorStatsBucket {
  /** Vendas pagas (sem os downloads grátis). */
  sales: number;
  /** Downloads de produtos grátis. */
  freeClaims: number;
  /** Valor pago pelos compradores. */
  gross: number;
  /** Parte do criador, já sem a comissão. */
  net: number;
}

export interface CreatorStats {
  total: CreatorStatsBucket;
  /** Mês atual (horário de Brasília). */
  month: CreatorStatsBucket;
  /** Média das notas de todos os produtos, ou null sem avaliações. */
  averageRating: number | null;
  reviewsCount: number;
}

const BRT_OFFSET_MS = 3 * 3600 * 1000;

/** "2026-10" no horário de Brasília — a mesma regra do servidor
 *  (monthKeyOf em creatorStats.ts). */
export function currentMonthKey(now: Date = new Date()): string {
  const brt = new Date(now.getTime() - BRT_OFFSET_MS);
  return `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, '0')}`;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function readBucket(raw: unknown): CreatorStatsBucket {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    // Nunca negativo na tela, mesmo se um estorno chegar antes da venda.
    sales:      Math.max(0, Math.trunc(num(b.sales))),
    freeClaims: Math.max(0, Math.trunc(num(b.freeClaims))),
    gross:      Math.max(0, Math.round(num(b.gross) * 100) / 100),
    net:        Math.max(0, Math.round(num(b.net) * 100) / 100),
  };
}

export const EMPTY_CREATOR_STATS: CreatorStats = {
  total:         readBucket(null),
  month:         readBucket(null),
  averageRating: null,
  reviewsCount:  0,
};

function parseStats(data: Record<string, unknown> | undefined): CreatorStats {
  if (!data) return EMPTY_CREATOR_STATS;
  const months = (data.months && typeof data.months === 'object' ? data.months : {}) as Record<string, unknown>;
  const reviewsCount = Math.max(0, Math.trunc(num(data.reviewsCount)));
  const ratingSum    = Math.max(0, num(data.ratingSum));
  return {
    total:         readBucket(data.total),
    month:         readBucket(months[currentMonthKey()]),
    averageRating: reviewsCount > 0 ? Math.round((ratingSum / reviewsCount) * 10) / 10 : null,
    reviewsCount,
  };
}

/** Escuta o resumo em tempo real. Documento ainda inexistente
 *  (criador sem venda) chega como tudo zerado. */
export function listenToCreatorStats(
  uid: string,
  onData: (stats: CreatorStats) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, 'creatorStats', uid),
    snap => onData(parseStats(snap.exists() ? snap.data() : undefined)),
    error => onError(error),
  );
}

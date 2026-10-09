// ============================================
// LUMINA — RESUMO DO CRIADOR (leitura)
// src/services/marketplace/creatorStatsService.ts
//
// Lê creatorStats/{uid}, gravado SÓ pelo servidor
// (functions/src/creators/creatorStats.ts). Uma leitura por
// abertura do painel e uma por venda, avaliação ou visualização
// nova — nunca soma vendas no celular.
//
// A regra deixa ler só o dono e o admin.
//
// Entrega 2 (09/10/2026): histórico de 6 meses (gráfico e
// comparação), meta automática do mês e o mapa de produtos com
// visualizações e pedidos (sugestões de próximo passo).
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

export interface CreatorMonth {
  /** "2026-10" */
  key: string;
  bucket: CreatorStatsBucket;
}

export interface CreatorProductStats {
  id: string;
  title: string;
  status: string;
  views: number;
  /** Vendas + downloads grátis. */
  orders: number;
}

export interface CreatorStats {
  total: CreatorStatsBucket;
  /** Mês atual (horário de Brasília). */
  month: CreatorStatsBucket;
  /** Mês anterior, para a comparação. */
  previousMonth: CreatorMonth;
  /** Últimos 6 meses, do mais antigo ao atual. */
  history: CreatorMonth[];
  /** Meta automática do mês, em reais (faturamento). */
  monthlyGoal: number;
  /** Média das notas de todos os produtos, ou null sem avaliações. */
  averageRating: number | null;
  reviewsCount: number;
  /** Produtos que ainda existem (fora os retirados da venda). */
  products: CreatorProductStats[];
}

const BRT_OFFSET_MS = 3 * 3600 * 1000;
const HISTORY_MONTHS = 6;
const GOAL_LOOKBACK_MONTHS = 3;
/** Meta do primeiro mês (ou de quem ficou 3 meses sem vender). */
export const FIRST_GOAL = 50;

/** "2026-10" no horário de Brasília — a mesma regra do servidor
 *  (monthKeyOf em creatorStats.ts). */
export function currentMonthKey(now: Date = new Date()): string {
  const brt = new Date(now.getTime() - BRT_OFFSET_MS);
  return `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Chave de `offset` meses antes (offset 1 = mês anterior). */
export function monthKeyBefore(key: string, offset: number): string {
  const year  = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7)) - 1 - offset;
  const date  = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Dia do mês no horário de Brasília (1–31). */
export function currentDayOfMonth(now: Date = new Date()): number {
  return new Date(now.getTime() - BRT_OFFSET_MS).getUTCDate();
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readBucket(raw: unknown): CreatorStatsBucket {
  const b = asRecord(raw);
  return {
    // Nunca negativo na tela, mesmo se um estorno chegar antes da venda.
    sales:      Math.max(0, Math.trunc(num(b.sales))),
    freeClaims: Math.max(0, Math.trunc(num(b.freeClaims))),
    gross:      Math.max(0, Math.round(num(b.gross) * 100) / 100),
    net:        Math.max(0, Math.round(num(b.net) * 100) / 100),
  };
}

function readProducts(raw: unknown): CreatorProductStats[] {
  const map = asRecord(raw);
  return Object.keys(map)
    .map(id => {
      const p = asRecord(map[id]);
      return {
        id,
        title:     typeof p.title === 'string' ? p.title : '',
        status:    typeof p.status === 'string' ? p.status : '',
        isDeleted: p.isDeleted === true,
        views:     Math.max(0, Math.trunc(num(p.views))),
        orders:    Math.max(0, Math.trunc(num(p.orders))),
      };
    })
    // Sem status = só sobrou o contador de um produto apagado.
    .filter(p => p.status !== '' && !p.isDeleted)
    .map(({ isDeleted: _ignored, ...rest }) => rest);
}

function buildStats(data: Record<string, unknown> | undefined): CreatorStats {
  const months  = asRecord(data?.months);
  const current = currentMonthKey();

  const history: CreatorMonth[] = [];
  for (let offset = HISTORY_MONTHS - 1; offset >= 0; offset--) {
    const key = monthKeyBefore(current, offset);
    history.push({ key, bucket: readBucket(months[key]) });
  }

  // Meta automática: bater o melhor dos 3 meses anteriores.
  let best = 0;
  for (let offset = 1; offset <= GOAL_LOOKBACK_MONTHS; offset++) {
    best = Math.max(best, readBucket(months[monthKeyBefore(current, offset)]).net);
  }

  const reviewsCount = Math.max(0, Math.trunc(num(data?.reviewsCount)));
  const ratingSum    = Math.max(0, num(data?.ratingSum));
  const previousKey  = monthKeyBefore(current, 1);

  return {
    total:         readBucket(data?.total),
    month:         readBucket(months[current]),
    previousMonth: { key: previousKey, bucket: readBucket(months[previousKey]) },
    history,
    monthlyGoal:   best > 0 ? best : FIRST_GOAL,
    averageRating: reviewsCount > 0 ? Math.round((ratingSum / reviewsCount) * 10) / 10 : null,
    reviewsCount,
    products:      readProducts(data?.products),
  };
}

export const EMPTY_CREATOR_STATS: CreatorStats = buildStats(undefined);

/** Escuta o resumo em tempo real. Documento ainda inexistente
 *  (criador sem venda) chega como tudo zerado. */
export function listenToCreatorStats(
  uid: string,
  onData: (stats: CreatorStats) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, 'creatorStats', uid),
    snap => onData(buildStats(snap.exists() ? snap.data() : undefined)),
    error => onError(error),
  );
}

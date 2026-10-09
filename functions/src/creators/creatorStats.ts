// ============================================
// LUMINA — RESUMO DO CRIADOR (Painel do Criador)
// functions/src/creators/creatorStats.ts
//
// Números do rodapé do Painel do Criador (decisão de Kaio,
// 09/10/2026): Vendas, Faturamento e Avaliação média, em TOTAL e
// ESTE MÊS. O app lê UM documento (creatorStats/{uid}) — nunca soma
// vendas no celular (custo crescente e número forjável).
//
// QUEM GRAVA: só estes gatilhos e a manutenção do superadmin.
// Nenhuma função de pagamento foi alterada: os gatilhos olham o
// resultado que o webhook, a compra grátis, o reembolso e as
// avaliações JÁ gravam em `sales` e `products`.
//
// VENDA CONTADA: status 'paid' ou 'refund_requested' (o dinheiro
// ainda está com o criador), fora compra de cristais. Saiu para
// 'refunded'/'cancelled' → sai da conta. Voltou para 'paid'
// (reembolso recusado) → volta.
//
// IDEMPOTÊNCIA: o gatilho pode rodar mais de uma vez para a mesma
// gravação, e fora de ordem. Por isso ele NÃO soma "o que mudou
// nesta gravação": numa transaction, relê a venda, compara com a
// marca do que já foi aplicado (creatorStats/{uid}/saleMarks/{id})
// e aplica só a diferença. Rodar 2x = mesmo resultado.
// Mesma ideia para as notas (ratingMarks/{productId}).
//
// MÊS: o da confirmação do pagamento (paidAt), no horário de
// Brasília (UTC−3, sem horário de verão desde 2019). Um estorno
// tira a venda do MÊS EM QUE ELA FOI FEITA — assim "outubro"
// mostra o que outubro realmente rendeu. Mês novo começa zerado,
// sem job à meia-noite: é só outra chave no mapa `months`.
//
// EXCLUSÃO DE CONTA: a anonimização troca sellerId/ownerId por
// anon_… — gatilho ignora (troca de dono não é venda). Conta em
// exclusão é ignorada; o resumo é apagado no passo 6 do
// processAccountDeletion.
// ============================================

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  DocumentData, FieldValue, Query, QueryDocumentSnapshot, QuerySnapshot,
  Transaction, WriteBatch,
} from 'firebase-admin/firestore';
import { assertAuthenticated, assertSuperAdmin } from '../utils/adminGuard';

const db = admin.firestore();

const COUNTED_STATUSES = new Set(['paid', 'refund_requested']);
const BRT_OFFSET_MS    = 3 * 3600 * 1000;
const UID_PATTERN      = /^[A-Za-z0-9_-]{1,128}$/;
const BATCH_LIMIT      = 400;

// ============================================
// Utilitários
// ============================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** "2026-10" no horário de Brasília. Exportado para o app usar a
 *  mesma regra (ver creatorStatsService.currentMonthKey). */
export function monthKeyOf(date: Date): string {
  const brt = new Date(date.getTime() - BRT_OFFSET_MS);
  const month = String(brt.getUTCMonth() + 1).padStart(2, '0');
  return `${brt.getUTCFullYear()}-${month}`;
}

function toDate(value: unknown): Date | null {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

/** Dono válido para ter resumo: uid real, nunca o pseudônimo. */
function isRealUid(value: unknown): value is string {
  return typeof value === 'string' && UID_PATTERN.test(value) && !value.startsWith('anon_');
}

const statsRef = (uid: string) => db.collection('creatorStats').doc(uid);

/** Conta em exclusão (ou já apagada) não ganha resumo novo. */
async function isAccountGone(t: Transaction, uid: string): Promise<boolean> {
  const [userSnap, deletionSnap] = await Promise.all([
    t.get(db.collection('users').doc(uid)),
    t.get(db.collection('accountDeletions').doc(uid)),
  ]);
  return !userSnap.exists || deletionSnap.exists;
}

// ============================================
// Contribuição de UMA venda para o resumo
// ============================================

interface SaleMark {
  counted: boolean;
  month:   string;
  isFree:  boolean;
  gross:   number; // valor pago pelo comprador
  net:     number; // parte do criador (sem a comissão)
}

const NOT_COUNTED: SaleMark = { counted: false, month: '', isFree: false, gross: 0, net: 0 };

function saleMarkOf(sale: DocumentData | undefined): SaleMark {
  if (!sale || sale.type === 'coins_purchase') return NOT_COUNTED;
  if (!COUNTED_STATUSES.has(String(sale.status))) return NOT_COUNTED;
  const gross = round2(Math.max(0, toNumber(sale.amount)));
  const when  = toDate(sale.paidAt) ?? toDate(sale.createdAt) ?? new Date();
  return {
    counted: true,
    month:   monthKeyOf(when),
    isFree:  gross <= 0,
    gross,
    net:     round2(Math.max(0, toNumber(sale.sellerAmount))),
  };
}

function readMark(data: DocumentData | undefined): SaleMark {
  if (!data || data.counted !== true || typeof data.month !== 'string') return NOT_COUNTED;
  return {
    counted: true,
    month:   data.month,
    isFree:  data.isFree === true,
    gross:   toNumber(data.gross),
    net:     toNumber(data.net),
  };
}

function sameMark(a: SaleMark, b: SaleMark): boolean {
  return a.counted === b.counted && a.month === b.month && a.isFree === b.isFree &&
    a.gross === b.gross && a.net === b.net;
}

interface Bucket { sales: number; freeClaims: number; gross: number; net: number }

const emptyBucket = (): Bucket => ({ sales: 0, freeClaims: 0, gross: 0, net: 0 });

function addMark(bucket: Bucket, mark: SaleMark, sign: 1 | -1): void {
  if (!mark.counted) return;
  if (mark.isFree) bucket.freeClaims += sign;
  else bucket.sales += sign;
  bucket.gross = round2(bucket.gross + sign * mark.gross);
  bucket.net   = round2(bucket.net + sign * mark.net);
}

function incrementsOf(bucket: Bucket): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  (Object.keys(bucket) as Array<keyof Bucket>).forEach(key => {
    if (bucket[key] !== 0) out[key] = FieldValue.increment(bucket[key]);
  });
  return out;
}

// ============================================
// GATILHO — vendas
// ============================================

export const onSaleWrittenCreatorStats = onDocumentWritten(
  { document: 'sales/{saleId}', retry: true },
  async (event) => {
    const saleId = event.params.saleId;
    const before = event.data?.before.exists ? event.data.before.data() : undefined;
    const after  = event.data?.after.exists ? event.data.after.data() : undefined;

    // Compra de cristais nunca entra.
    if ((after ?? before)?.type === 'coins_purchase') return;

    // Troca de dono = anonimização da exclusão de conta.
    if (before && after && before.sellerId !== after.sellerId) return;

    const sellerId = (after ?? before)?.sellerId;
    if (!isRealUid(sellerId)) return;

    // Atalhos sem leitura: nada que importa para o resumo mudou
    // (a maioria das gravações em sales — Pix criado, vencido…).
    if (before && after && sameMark(saleMarkOf(before), saleMarkOf(after))) return;
    if (!before && !saleMarkOf(after).counted) return;
    if (!after && !saleMarkOf(before).counted) return;

    const saleRef = db.collection('sales').doc(saleId);
    const markRef = statsRef(sellerId).collection('saleMarks').doc(saleId);

    await db.runTransaction(async (t) => {
      const [saleSnap, markSnap, gone] = await Promise.all([
        t.get(saleRef), t.get(markRef), isAccountGone(t, sellerId),
      ]);
      if (gone) return;

      const fresh   = saleSnap.exists ? saleSnap.data() : undefined;
      // A venda pode ter sido anonimizada entre o evento e agora.
      if (fresh && fresh.sellerId !== sellerId) return;

      const desired = saleMarkOf(fresh);
      const applied = readMark(markSnap.data());
      if (sameMark(desired, applied)) return; // já aplicado (reexecução)

      const total  = emptyBucket();
      const months = new Map<string, Bucket>();
      const monthBucket = (key: string) => {
        if (!months.has(key)) months.set(key, emptyBucket());
        return months.get(key)!;
      };

      if (applied.counted) {
        addMark(total, applied, -1);
        addMark(monthBucket(applied.month), applied, -1);
      }
      if (desired.counted) {
        addMark(total, desired, 1);
        addMark(monthBucket(desired.month), desired, 1);
      }

      const monthsPatch: Record<string, Record<string, FieldValue>> = {};
      months.forEach((bucket, key) => {
        const inc = incrementsOf(bucket);
        if (Object.keys(inc).length) monthsPatch[key] = inc;
      });

      t.set(statsRef(sellerId), {
        total:     incrementsOf(total),
        months:    monthsPatch,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      if (desired.counted) t.set(markRef, { ...desired, updatedAt: FieldValue.serverTimestamp() });
      else t.delete(markRef);
    });
  },
);

// ============================================
// GATILHO — notas dos produtos
// ============================================

interface RatingMark { ratingSum: number; reviewsCount: number }

function ratingOf(product: DocumentData | undefined): RatingMark {
  if (!product) return { ratingSum: 0, reviewsCount: 0 };
  return {
    ratingSum:    Math.max(0, toNumber(product.ratingSum)),
    reviewsCount: Math.max(0, Math.trunc(toNumber(product.reviewsCount))),
  };
}

export const onProductWrittenCreatorStats = onDocumentWritten(
  { document: 'products/{productId}', retry: true },
  async (event) => {
    const productId = event.params.productId;
    const before = event.data?.before.exists ? event.data.before.data() : undefined;
    const after  = event.data?.after.exists ? event.data.after.data() : undefined;

    if (before && after && before.ownerId !== after.ownerId) return;
    const ownerId = (after ?? before)?.ownerId;
    if (!isRealUid(ownerId)) return;

    // A maioria das gravações em products não mexe na nota.
    const a = ratingOf(before);
    const b = ratingOf(after);
    if (before && after && a.ratingSum === b.ratingSum && a.reviewsCount === b.reviewsCount) return;

    const productRef = db.collection('products').doc(productId);
    const markRef    = statsRef(ownerId).collection('ratingMarks').doc(productId);

    await db.runTransaction(async (t) => {
      const [productSnap, markSnap, gone] = await Promise.all([
        t.get(productRef), t.get(markRef), isAccountGone(t, ownerId),
      ]);
      if (gone) return;

      const fresh = productSnap.exists ? productSnap.data() : undefined;
      if (fresh && fresh.ownerId !== ownerId) return;

      const desired = ratingOf(fresh);
      const applied = ratingOf(markSnap.data());
      const dSum    = desired.ratingSum - applied.ratingSum;
      const dCount  = desired.reviewsCount - applied.reviewsCount;
      if (dSum === 0 && dCount === 0) return;

      t.set(statsRef(ownerId), {
        ...(dSum !== 0   && { ratingSum:    FieldValue.increment(dSum) }),
        ...(dCount !== 0 && { reviewsCount: FieldValue.increment(dCount) }),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      if (desired.reviewsCount > 0 || desired.ratingSum > 0) {
        t.set(markRef, { ...desired, updatedAt: FieldValue.serverTimestamp() });
      } else {
        t.delete(markRef);
      }
    });
  },
);

// ============================================
// MANUTENÇÃO — reconstrói o resumo a partir dos dados reais
// ============================================
// Usada UMA vez depois do deploy (vendas e notas anteriores aos
// gatilhos) e, se um dia preciso, para corrigir um criador.
// Só superadmin. Rodar com o app quieto: uma venda paga DURANTE a
// reconstrução de um criador pode ficar de fora — rodar de novo
// para ele resolve.
//   { uid: "<uid>" } → um criador
//   {}               → todos os que têm venda ou nota

interface CreatorAccumulator {
  total:     Bucket;
  months:    Map<string, Bucket>;
  saleMarks: Map<string, SaleMark>;
  ratings:   Map<string, RatingMark>;
}

function newAccumulator(): CreatorAccumulator {
  return { total: emptyBucket(), months: new Map(), saleMarks: new Map(), ratings: new Map() };
}

async function writeCreator(uid: string, acc: CreatorAccumulator): Promise<void> {
  const ref = statsRef(uid);
  // Apaga resumo e marcas antigos e grava tudo de novo.
  await db.recursiveDelete(ref);

  let ratingSum = 0;
  let reviewsCount = 0;
  acc.ratings.forEach(r => { ratingSum += r.ratingSum; reviewsCount += r.reviewsCount; });

  const months: Record<string, Bucket> = {};
  acc.months.forEach((bucket, key) => { months[key] = bucket; });

  const writes: Array<(batch: WriteBatch) => void> = [];
  writes.push(batch => batch.set(ref, {
    total:  acc.total,
    months,
    ratingSum:    round2(ratingSum),
    reviewsCount,
    rebuiltAt:    FieldValue.serverTimestamp(),
    updatedAt:    FieldValue.serverTimestamp(),
  }));
  acc.saleMarks.forEach((mark, saleId) => {
    writes.push(batch => batch.set(ref.collection('saleMarks').doc(saleId), {
      ...mark, updatedAt: FieldValue.serverTimestamp(),
    }));
  });
  acc.ratings.forEach((rating, productId) => {
    writes.push(batch => batch.set(ref.collection('ratingMarks').doc(productId), {
      ...rating, updatedAt: FieldValue.serverTimestamp(),
    }));
  });

  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    writes.slice(i, i + BATCH_LIMIT).forEach(write => write(batch));
    await batch.commit();
  }
}

/** Percorre uma consulta em páginas, sem carregar tudo de uma vez. */
async function forEachDoc(
  query: Query,
  fn: (id: string, data: DocumentData) => void,
): Promise<void> {
  let last: QueryDocumentSnapshot | null = null;
  for (;;) {
    const page: QuerySnapshot = await (last ? query.startAfter(last) : query).limit(500).get();
    page.docs.forEach(d => fn(d.id, d.data()));
    if (page.size < 500) return;
    last = page.docs[page.docs.length - 1];
  }
}

export const rebuildCreatorStats = onCall(
  { timeoutSeconds: 540, memory: '512MiB' },
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    await assertSuperAdmin(request.auth!.uid);

    const onlyUid = (request.data as { uid?: unknown } | undefined)?.uid;
    if (onlyUid !== undefined && !isRealUid(onlyUid)) {
      throw new HttpsError('invalid-argument', 'uid inválido.');
    }

    const creators = new Map<string, CreatorAccumulator>();
    const accFor = (uid: string) => {
      if (!creators.has(uid)) creators.set(uid, newAccumulator());
      return creators.get(uid)!;
    };

    const salesQuery = onlyUid
      ? db.collection('sales').where('sellerId', '==', onlyUid).orderBy('__name__')
      : db.collection('sales').orderBy('__name__');
    await forEachDoc(salesQuery, (saleId, sale) => {
      if (!isRealUid(sale.sellerId)) return;
      const mark = saleMarkOf(sale);
      if (!mark.counted) return;
      const acc = accFor(sale.sellerId);
      acc.saleMarks.set(saleId, mark);
      addMark(acc.total, mark, 1);
      if (!acc.months.has(mark.month)) acc.months.set(mark.month, emptyBucket());
      addMark(acc.months.get(mark.month)!, mark, 1);
    });

    const productsQuery = onlyUid
      ? db.collection('products').where('ownerId', '==', onlyUid).orderBy('__name__')
      : db.collection('products').orderBy('__name__');
    await forEachDoc(productsQuery, (productId, product) => {
      if (!isRealUid(product.ownerId)) return;
      const rating = ratingOf(product);
      if (rating.reviewsCount === 0 && rating.ratingSum === 0) return;
      accFor(product.ownerId).ratings.set(productId, rating);
    });

    // Um criador pedido sem nenhuma venda ou nota ainda ganha o
    // resumo zerado (o painel mostra "ainda sem vendas").
    if (typeof onlyUid === 'string') accFor(onlyUid);

    let written = 0;
    for (const [uid, acc] of creators) {
      const userSnap = await db.collection('users').doc(uid).get();
      if (!userSnap.exists) continue; // conta apagada
      await writeCreator(uid, acc);
      written++;
    }

    console.log('[rebuildCreatorStats] concluído', { by: request.auth!.uid, onlyUid: onlyUid ?? null, written });
    return { creators: written };
  },
);

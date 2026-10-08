// ============================================
// LUMINA — AVALIAÇÕES DE PRODUTOS
// functions/src/products/productReviews.ts
//
// Decisões de produto (Kaio, 08/10/2026):
//   • nota de 1 a 5 estrelas + comentário OPCIONAL (até 500);
//   • só quem comprou e JÁ ABRIU o conteúdo pelo menos uma vez;
//   • a nota pode ser trocada depois (estilo Mercado Livre);
//   • o marketplace mostra a média e a quantidade, ou "Novo".
//
// SEGURANÇA
//   O app não grava em productReviews nem nos campos de nota do
//   produto (firestore.rules). Tudo passa por aqui:
//   • submitProductReview — cria ou edita a avaliação e atualiza a
//     média do produto na MESMA transaction (sem race entre duas
//     avaliações simultâneas);
//   • moderateProductReview — superadmin oculta/mostra o comentário.
//     A nota continua contando: quem comprou e avaliou não perde o
//     voto por causa do texto;
//   • onPurchaseRevokedRemoveReview — compra estornada ou revogada
//     tira a avaliação e recalcula a média;
//   • recomputeProductRatings — manutenção (superadmin): recalcula
//     a média a partir das avaliações gravadas.
//
// O produto guarda ratingSum, reviewsCount e averageRating. O
// marketplace mostra as estrelas sem nenhuma leitura extra.
//
// "Já abriu" = purchases/{uid}_{productId}.firstViewedAt, gravado
// pelo getPurchasedContent (productChanges.ts) na primeira vez que
// o comprador abre o conteúdo.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp, QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { assertAuthenticated, assertSuperAdmin } from '../utils/adminGuard';
import { assertUserNotBlocked } from '../utils/assertUserNotBlocked';
import { createAuditLog } from '../utils/auditLog';

const db = admin.firestore();

const MAX_COMMENT        = 500;
const MAX_HIDE_REASON    = 300;
const MAX_FIRST_NAME     = 30;
const EDIT_COOLDOWN_MS   = 15 * 1000;
const RECOMPUTE_MAX      = 300;
const DEFAULT_NAME       = 'Comprador';

// ── Validação ──

function assertProductId(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 200 || value.includes('/')) {
    throw new HttpsError('invalid-argument', 'Produto inválido.');
  }
  return value;
}

function assertRating(value: unknown): 1 | 2 | 3 | 4 | 5 {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new HttpsError('invalid-argument', 'Escolha de 1 a 5 estrelas.');
  }
  return value as 1 | 2 | 3 | 4 | 5;
}

/**
 * Bloqueia o que transformaria o comentário em canal de venda por
 * fora (e tiraria a comissão) ou em vazamento de contato: links,
 * e-mail, telefone, @, chave Pix e nomes de outras plataformas.
 * A lista é conservadora de propósito — um falso positivo custa
 * reescrever uma frase; um falso negativo custa uma venda por fora.
 */
const CONTACT_PATTERNS: RegExp[] = [
  /(https?:\/\/|www\.)/i,
  /\b[a-z0-9-]+\.(com|net|org|br|me|io|app|link|ly|gg|tv|xyz|site|online|store|shop|bio)\b/i,
  /[^\s@]+@[^\s@]+\.[^\s@]+/,
  /(^|[\s(])@[a-z0-9_.]{2,}/i,
  /(\d[\s().\-]*){8,}/,
  /\bpix\b/i,
  /\barroba\b|\bponto\s*com\b/i,
  /\b(whats|whatsapp|zap|telegram|insta|instagram|onlyfans|privacy|tiktok|twitter|facebook)\b/i,
];

function normalizeComment(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new HttpsError('invalid-argument', 'Comentário inválido.');

  const text = value
    // Caracteres de controle (exceto quebra de linha) não têm lugar
    // num comentário e podem quebrar a exibição.
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  if (text.length > MAX_COMMENT) {
    throw new HttpsError('invalid-argument', `O comentário pode ter até ${MAX_COMMENT} caracteres.`);
  }
  if (text && CONTACT_PATTERNS.some(p => p.test(text))) {
    throw new HttpsError(
      'invalid-argument',
      'O comentário não pode ter links, contatos, @, telefone, chave Pix ou nomes de outras plataformas.',
    );
  }
  return text;
}

function firstName(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_NAME;
  const first = raw.trim().split(/\s+/)[0] ?? '';
  return first ? first.slice(0, MAX_FIRST_NAME) : DEFAULT_NAME;
}

/** Conta verificada e não banida — mesmas claims das regras (av/ban). */
function assertVerifiedToken(token: Record<string, unknown> | undefined): void {
  if (!token || token.av !== true) {
    throw new HttpsError('permission-denied', 'Conclua a verificação de idade para avaliar.');
  }
  if (token.ban === true) {
    throw new HttpsError('permission-denied', 'Conta encerrada.');
  }
}

function roundAverage(sum: number, count: number): number {
  if (count <= 0) return 0;
  return Math.round((sum / count) * 100) / 100;
}

// Agregado atual do produto. Produto antigo sem ratingSum mas com
// contagem é dado inconsistente: falha alto em vez de calcular uma
// média errada — o recomputeProductRatings corrige.
function currentAggregate(product: DocumentData): { sum: number; count: number } {
  const count = Number.isFinite(product.reviewsCount) ? Math.max(0, Number(product.reviewsCount)) : 0;
  const hasSum = Number.isFinite(product.ratingSum);
  if (count > 0 && !hasSum) {
    throw new HttpsError(
      'failed-precondition',
      'As avaliações deste produto estão sendo atualizadas. Tente de novo em instantes.',
    );
  }
  return { sum: hasSum ? Math.max(0, Number(product.ratingSum)) : 0, count };
}

// ============================================
// CRIAR OU EDITAR AVALIAÇÃO (comprador)
// ============================================
export const submitProductReview = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;
  assertVerifiedToken(request.auth?.token as Record<string, unknown> | undefined);
  await assertUserNotBlocked(uid);

  const data      = (request.data ?? {}) as { productId?: unknown; rating?: unknown; comment?: unknown };
  const productId = assertProductId(data.productId);
  const rating    = assertRating(data.rating);
  const comment   = normalizeComment(data.comment);

  const userSnap = await db.collection('users').doc(uid).get();
  const userName = firstName(userSnap.get('name'));

  const purchaseRef = db.collection('purchases').doc(`${uid}_${productId}`);
  const productRef  = db.collection('products').doc(productId);
  const reviewRef   = db.collection('productReviews').doc(`${uid}_${productId}`);

  const result = await db.runTransaction(async (t) => {
    const [purchaseSnap, productSnap, reviewSnap] = await Promise.all([
      t.get(purchaseRef), t.get(productRef), t.get(reviewRef),
    ]);

    const purchase = purchaseSnap.data();
    if (!purchase || purchase.buyerId !== uid || purchase.status !== 'active' || purchase.isRevoked === true) {
      throw new HttpsError('permission-denied', 'Só quem comprou este conteúdo pode avaliar.');
    }
    if (!purchase.firstViewedAt) {
      throw new HttpsError('failed-precondition', 'Abra o conteúdo pelo menos uma vez para poder avaliar.');
    }

    const product = productSnap.data();
    if (!product) throw new HttpsError('not-found', 'Produto não encontrado.');
    if (product.ownerId === uid) {
      throw new HttpsError('permission-denied', 'Você não pode avaliar o próprio produto.');
    }

    const existing = reviewSnap.data();
    const now      = Timestamp.now();

    if (existing) {
      // Reenvio idêntico: nada muda (idempotente, sem gravação).
      if (existing.rating === rating && (existing.comment ?? '') === comment) {
        return {
          isNew: false, changed: false, oldRating: rating,
          averageRating: Number(product.averageRating ?? 0),
          reviewsCount:  Number(product.reviewsCount ?? 0),
        };
      }
      const last = (existing.updatedAt as Timestamp | undefined)?.toMillis() ?? 0;
      if (now.toMillis() - last < EDIT_COOLDOWN_MS) {
        throw new HttpsError('resource-exhausted', 'Aguarde alguns segundos antes de editar de novo.');
      }
    }

    const { sum, count } = currentAggregate(product);
    const oldRating = existing ? Number(existing.rating) : 0;
    const newSum    = sum - oldRating + rating;
    const newCount  = existing ? count : count + 1;
    const average   = roundAverage(newSum, newCount);

    if (existing) {
      t.update(reviewRef, {
        rating,
        comment,
        userName,
        isEdited:  true,
        updatedAt: now,
      });
    } else {
      t.set(reviewRef, {
        productId,
        userId:    uid,
        userName,
        rating,
        comment,
        isHidden:  false,
        isEdited:  false,
        createdAt: now,
        updatedAt: now,
      });
    }

    t.update(productRef, {
      ratingSum:       newSum,
      reviewsCount:    newCount,
      averageRating:   average,
      ratingUpdatedAt: now,
    });

    return {
      isNew: !existing, changed: true, oldRating,
      averageRating: average, reviewsCount: newCount,
    };
  });

  if (result.changed) {
    createAuditLog({
      action: result.isNew ? 'review_created' : 'review_updated',
      performedBy: uid,
      targetId: productId,
      targetType: 'product',
      metadata: { reviewId: `${uid}_${productId}`, rating, oldRating: result.oldRating, hasComment: comment.length > 0 },
      req: request.rawRequest,
    }).catch(() => {});
  }

  return {
    success:       true,
    isNew:         result.isNew,
    averageRating: result.averageRating,
    reviewsCount:  result.reviewsCount,
  };
});

// ============================================
// MODERAÇÃO DO COMENTÁRIO (superadmin)
// ============================================
export const moderateProductReview = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const adminUid: string = request.auth!.uid;
  await assertSuperAdmin(adminUid);

  const data = (request.data ?? {}) as { reviewId?: unknown; hide?: unknown; reason?: unknown };
  if (typeof data.reviewId !== 'string' || !data.reviewId || data.reviewId.includes('/')) {
    throw new HttpsError('invalid-argument', 'Avaliação inválida.');
  }
  const hide   = data.hide === true;
  const reason = typeof data.reason === 'string' ? data.reason.trim().slice(0, MAX_HIDE_REASON) : '';
  if (hide && !reason) throw new HttpsError('invalid-argument', 'Informe o motivo.');

  const reviewRef = db.collection('productReviews').doc(data.reviewId);
  const snap = await reviewRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Avaliação não encontrada.');

  await reviewRef.update(hide
    ? { isHidden: true,  hiddenReason: reason, hiddenAt: FieldValue.serverTimestamp(), hiddenBy: adminUid }
    : { isHidden: false, hiddenReason: FieldValue.delete(), hiddenAt: FieldValue.delete(), hiddenBy: FieldValue.delete() });

  await createAuditLog({
    action: hide ? 'review_hidden' : 'review_unhidden',
    performedBy: adminUid,
    targetId: String(snap.get('productId') ?? data.reviewId),
    targetType: 'product',
    metadata: { reviewId: data.reviewId, reason: hide ? reason : null },
    req: request.rawRequest,
  });

  return { success: true };
});

// ============================================
// COMPRA ESTORNADA/REVOGADA → AVALIAÇÃO SAI
//
// onDocumentUpdated e NÃO onDocumentWritten: a exclusão de conta
// apaga as compras, e a avaliação dessa pessoa deve continuar
// contando (anonimizada). Só a PERDA DE ACESSO tira o voto.
// Idempotente: a transaction confere se a avaliação ainda existe.
// ============================================
export const onPurchaseRevokedRemoveReview = onDocumentUpdated('purchases/{purchaseId}', async (event) => {
  const before = event.data?.before.data();
  const after  = event.data?.after.data();
  if (!before || !after) return;

  const hadAccess  = before.status === 'active' && before.isRevoked !== true;
  const hasAccess  = after.status === 'active' && after.isRevoked !== true;
  if (!hadAccess || hasAccess) return;

  const buyerId   = String(after.buyerId ?? '');
  const productId = String(after.productId ?? '');
  if (!buyerId || !productId) return;

  const reviewRef  = db.collection('productReviews').doc(`${buyerId}_${productId}`);
  const productRef = db.collection('products').doc(productId);

  const removed = await db.runTransaction(async (t) => {
    const [reviewSnap, productSnap] = await Promise.all([t.get(reviewRef), t.get(productRef)]);
    if (!reviewSnap.exists) return null;

    const rating = Number(reviewSnap.get('rating') ?? 0);
    t.delete(reviewRef);

    const product = productSnap.data();
    if (product && Number.isFinite(product.ratingSum)) {
      const count = Math.max(0, Number(product.reviewsCount ?? 0) - 1);
      const sum   = count === 0 ? 0 : Math.max(0, Number(product.ratingSum) - rating);
      t.update(productRef, {
        ratingSum:       sum,
        reviewsCount:    count,
        averageRating:   roundAverage(sum, count),
        ratingUpdatedAt: Timestamp.now(),
      });
    }
    return rating;
  });

  // Log estruturado (Cloud Logging). Sem createAuditLog aqui: o
  // gatilho não tem request, e o registro do estorno em si já é
  // auditado pelo approveRefund.
  if (removed !== null) {
    console.log(JSON.stringify({
      level: 'info', fn: 'onPurchaseRevokedRemoveReview',
      purchaseId: event.params.purchaseId, productId,
      rating: removed, status: after.status ?? null,
    }));
  }
});

// ============================================
// MANUTENÇÃO — RECALCULAR MÉDIAS (superadmin)
//
// Recalcula a partir das avaliações gravadas. Sem productId, passa
// por todos os produtos que têm avaliação ou contagem (até
// RECOMPUTE_MAX por chamada; chamar de novo continua do cursor).
// Rodar uma vez depois do deploy: corrige produtos com avaliações
// antigas, gravadas pelo app antes desta função existir.
// ============================================
async function recomputeOne(productId: string): Promise<{ count: number; average: number }> {
  const productRef = db.collection('products').doc(productId);
  const reviewsQ   = db.collection('productReviews').where('productId', '==', productId);

  return db.runTransaction(async (t) => {
    const [productSnap, reviewsSnap] = await Promise.all([t.get(productRef), t.get(reviewsQ)]);
    let sum = 0;
    let count = 0;
    reviewsSnap.docs.forEach(d => {
      const r = d.get('rating');
      if (Number.isInteger(r) && r >= 1 && r <= 5) { sum += r; count += 1; }
    });
    const average = roundAverage(sum, count);
    if (productSnap.exists) {
      t.update(productRef, {
        ratingSum: sum, reviewsCount: count, averageRating: average,
        ratingUpdatedAt: Timestamp.now(),
      });
    }
    return { count, average };
  });
}

export const recomputeProductRatings = onCall({ timeoutSeconds: 540 }, async (request) => {
  assertAuthenticated(request.auth?.uid);
  const adminUid: string = request.auth!.uid;
  await assertSuperAdmin(adminUid);

  const data = (request.data ?? {}) as { productId?: unknown; startAfter?: unknown };

  if (data.productId !== undefined && data.productId !== null) {
    const productId = assertProductId(data.productId);
    const r = await recomputeOne(productId);
    return { success: true, processed: 1, results: { [productId]: r }, nextCursor: null };
  }

  // Ids a partir das avaliações (fonte da verdade) e dos produtos
  // que dizem ter avaliação (para zerar contagens órfãs).
  const ids = new Set<string>();
  const reviewIds = await db.collection('productReviews').select('productId').get();
  reviewIds.docs.forEach((d: QueryDocumentSnapshot) => {
    const p = d.get('productId');
    if (typeof p === 'string' && p) ids.add(p);
  });
  const withCount = await db.collection('products').where('reviewsCount', '>', 0).select().get();
  withCount.docs.forEach(d => ids.add(d.id));

  const sorted = [...ids].sort();
  const from   = typeof data.startAfter === 'string' ? data.startAfter : '';
  const batch  = sorted.filter(id => id > from).slice(0, RECOMPUTE_MAX);

  let processed = 0;
  for (const id of batch) {
    await recomputeOne(id);
    processed += 1;
  }
  const nextCursor = batch.length === RECOMPUTE_MAX ? batch[batch.length - 1] : null;

  await createAuditLog({
    action: 'product_ratings_recomputed',
    performedBy: adminUid,
    targetId: 'all',
    targetType: 'product',
    metadata: { processed, totalProducts: sorted.length, nextCursor },
    req: request.rawRequest,
  });

  return { success: true, processed, totalProducts: sorted.length, nextCursor };
});

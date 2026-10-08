// ============================================
// REVIEW SERVICE — MARKETPLACE v2.0
// src/services/marketplace/reviewService.ts
//
// v2.0 — GRAVAÇÃO SÓ PELO SERVIDOR.
// createReview e updateReview gravavam direto no Firestore: dava
// para mandar nota 999, texto sem limite e links, e a média do
// produto nunca era atualizada. Agora:
//   • submitReview → CF submitProductReview (cria OU edita, valida
//     tudo e atualiza a média na mesma transaction);
//   • moderateReview → CF moderateProductReview (superadmin);
//   • as regras negam qualquer gravação do app em productReviews.
// As leituras (lista paginada e a avaliação do próprio usuário)
// continuam no cliente.
//
// reviewId = userId_productId (composto único)
// ============================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS } from '../../core/constants';
import {
  ProductReview, ReviewRating, ReviewEligibility, SubmitReviewResult,
} from '../../shared/types/marketplace/review.types';

/** Espelha MAX_COMMENT da CF — o servidor confere de novo. */
export const REVIEW_COMMENT_MAX = 500;

function buildReviewId(userId: string, productId: string): string {
  return `${userId}_${productId}`;
}

function toReview(id: string, data: DocumentData): ProductReview {
  return {
    id,
    productId:    String(data.productId ?? ''),
    userId:       String(data.userId ?? ''),
    userName:     typeof data.userName === 'string' ? data.userName : undefined,
    rating:       data.rating as ReviewRating,
    comment:      typeof data.comment === 'string' ? data.comment : '',
    isHidden:     data.isHidden === true,
    hiddenReason: typeof data.hiddenReason === 'string' ? data.hiddenReason : undefined,
    isEdited:     data.isEdited === true,
    createdAt:    data.createdAt?.toDate?.() ?? new Date(),
    updatedAt:    data.updatedAt?.toDate?.() ?? new Date(),
  };
}

/** Mensagem da CF (HttpsError) ou uma genérica. */
function errorMessage(error: unknown, fallback: string): string {
  const msg = (error as { message?: unknown })?.message;
  return typeof msg === 'string' && msg && msg !== 'internal' ? msg : fallback;
}

// ── Gravação (servidor) ──

export async function submitReview(
  productId: string,
  rating: ReviewRating,
  comment: string,
): Promise<SubmitReviewResult> {
  try {
    const fn = httpsCallable<
      { productId: string; rating: number; comment: string },
      SubmitReviewResult
    >(getFunctions(app, 'us-central1'), 'submitProductReview');
    const result = await fn({ productId, rating, comment: comment.trim() });
    return result.data;
  } catch (error) {
    throw new Error(errorMessage(error, 'Não foi possível enviar sua avaliação. Tente de novo.'));
  }
}

export async function moderateReview(
  reviewId: string,
  hide: boolean,
  reason: string,
): Promise<void> {
  try {
    const fn = httpsCallable<{ reviewId: string; hide: boolean; reason: string }, { success: boolean }>(
      getFunctions(app, 'us-central1'),
      'moderateProductReview',
    );
    await fn({ reviewId, hide, reason: reason.trim() });
  } catch (error) {
    throw new Error(errorMessage(error, 'Não foi possível moderar a avaliação.'));
  }
}

// ── Leitura (cliente) ──

/**
 * Pode avaliar? Lê a compra do próprio usuário (1 leitura, só
 * quando ele toca em "Avaliar"). O servidor confere de novo.
 */
export async function getReviewEligibility(
  userId: string,
  productId: string,
): Promise<ReviewEligibility> {
  const snap = await getDoc(
    doc(db, MARKETPLACE_COLLECTIONS.PURCHASES, `${userId}_${productId}`),
  );
  if (!snap.exists()) return 'not_buyer';
  const data = snap.data();
  if (data.status !== 'active' || data.isRevoked === true) return 'not_buyer';
  if (!data.firstViewedAt) return 'not_viewed';
  return 'ok';
}

export async function getMyReview(
  productId: string,
  userId: string,
): Promise<ProductReview | null> {
  const reviewId = buildReviewId(userId, productId);
  const snap = await getDoc(doc(db, MARKETPLACE_COLLECTIONS.REVIEWS, reviewId));
  if (!snap.exists()) return null;
  return toReview(snap.id, snap.data());
}

export async function getProductReviews(
  productId: string,
  pageSize = 10,
  lastDoc: DocumentSnapshot | null = null,
): Promise<{ reviews: ProductReview[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const constraints: Parameters<typeof query>[1][] = [
    where('productId', '==', productId),
    where('isHidden', '==', false),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1),
  ];

  if (lastDoc) constraints.push(startAfter(lastDoc));

  const snapshot = await getDocs(
    query(collection(db, MARKETPLACE_COLLECTIONS.REVIEWS), ...constraints),
  );

  const hasMore = snapshot.docs.length > pageSize;
  const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
  const reviews = docs.map(d => toReview(d.id, d.data()));

  return { reviews, lastDoc: docs.length > 0 ? docs[docs.length - 1] : null, hasMore };
}

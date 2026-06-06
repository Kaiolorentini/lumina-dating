// ============================================
// REVIEW SERVICE — MARKETPLACE
//
// reviewId = userId_productId (composto único)
// Verifica purchase ativa antes de criar review.
// averageRating atualizado por Cloud Function (FASE 6).
// ============================================

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS } from '../../core/constants';
import { ProductReview } from '../../shared/types/marketplace';
import { createAuditLog } from './auditService';

function buildReviewId(userId: string, productId: string): string {
  return `${userId}_${productId}`;
}

async function verifyActivePurchase(userId: string, productId: string): Promise<void> {
  const purchaseId = `${userId}_${productId}`;
  const purchaseRef = doc(db, MARKETPLACE_COLLECTIONS.PURCHASES, purchaseId);
  const snap = await getDoc(purchaseRef);
  if (!snap.exists() || snap.data().status !== 'active') {
    throw new Error('Você precisa comprar este produto para avaliá-lo');
  }
}

export async function createReview(
  productId: string,
  userId: string,
  data: { rating: 1 | 2 | 3 | 4 | 5; comment: string },
): Promise<void> {
  await verifyActivePurchase(userId, productId);

  const reviewId = buildReviewId(userId, productId);
  const reviewRef = doc(db, MARKETPLACE_COLLECTIONS.REVIEWS, reviewId);

  const existing = await getDoc(reviewRef);
  if (existing.exists()) throw new Error('Você já avaliou este produto. Use a edição.');

  await setDoc(reviewRef, {
    productId,
    userId,
    rating: data.rating,
    comment: data.comment,
    isHidden: false,
    isEdited: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await createAuditLog({
    action: 'review_created',
    performedBy: userId,
    targetId: reviewId,
    targetType: 'review',
    metadata: { productId, rating: data.rating },
  });
}

export async function updateReview(
  productId: string,
  userId: string,
  data: { rating: 1 | 2 | 3 | 4 | 5; comment: string },
): Promise<void> {
  const reviewId = buildReviewId(userId, productId);
  const reviewRef = doc(db, MARKETPLACE_COLLECTIONS.REVIEWS, reviewId);

  const existing = await getDoc(reviewRef);
  if (!existing.exists()) throw new Error('Avaliação não encontrada');
  if (existing.data().userId !== userId) throw new Error('Sem permissão');

  await setDoc(reviewRef, {
    rating: data.rating,
    comment: data.comment,
    isEdited: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await createAuditLog({
    action: 'review_updated',
    performedBy: userId,
    targetId: reviewId,
    targetType: 'review',
    metadata: { productId, newRating: data.rating },
  });
}

export async function getMyReview(
  productId: string,
  userId: string,
): Promise<ProductReview | null> {
  const reviewId = buildReviewId(userId, productId);
  const snap = await getDoc(doc(db, MARKETPLACE_COLLECTIONS.REVIEWS, reviewId));
  if (!snap.exists()) return null;
  return {
    ...snap.data(),
    createdAt: snap.data().createdAt?.toDate() ?? new Date(),
    updatedAt: snap.data().updatedAt?.toDate() ?? new Date(),
  } as ProductReview;
}

export async function getProductReviews(
  productId: string,
  pageSize = 10,
  lastDoc: DocumentSnapshot | null = null,
): Promise<{ reviews: ProductReview[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const constraints: any[] = [
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
  const reviews = docs.map(d => ({
    ...d.data(),
    createdAt: d.data().createdAt?.toDate() ?? new Date(),
    updatedAt: d.data().updatedAt?.toDate() ?? new Date(),
  } as ProductReview));

  return { reviews, lastDoc: docs.length > 0 ? docs[docs.length - 1] : null, hasMore };
}
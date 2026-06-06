// ============================================
// FAVORITES SERVICE — MARKETPLACE
//
// favoriteId = userId_productId (composto único)
// Distributed counter para analytics de favoritos.
// ============================================

import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  updateDoc,
  serverTimestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS } from '../../core/constants';
import { createAuditLog } from './auditService';

const SHARD_COUNT = 5;

function buildFavoriteId(userId: string, productId: string): string {
  return `${userId}_${productId}`;
}

async function incrementFavoriteShard(productId: string, delta: 1 | -1): Promise<void> {
  try {
    const shardId = Math.floor(Math.random() * SHARD_COUNT).toString();
    const shardRef = doc(
      db,
      MARKETPLACE_COLLECTIONS.PRODUCT_ANALYTICS,
      productId,
      'shards',
      shardId,
    );
    try {
      await updateDoc(shardRef, { favorites: increment(delta) });
    } catch {
      if (delta > 0) {
        await setDoc(shardRef, { views: 0, downloads: 0, favorites: 1 }, { merge: true });
      }
    }
  } catch {
    // Analytics não são críticos
  }
}

export async function addFavorite(userId: string, productId: string): Promise<void> {
  const favoriteId = buildFavoriteId(userId, productId);
  const favoriteRef = doc(db, MARKETPLACE_COLLECTIONS.FAVORITES, favoriteId);

  const existing = await getDoc(favoriteRef);
  if (existing.exists()) return; // Já favoritado — idempotente

  await setDoc(favoriteRef, {
    userId,
    productId,
    createdAt: serverTimestamp(),
  });

  // Distributed counter — shard aleatório
  await incrementFavoriteShard(productId, 1);

  await createAuditLog({
    action: 'favorite_added',
    performedBy: userId,
    targetId: favoriteId,
    targetType: 'product',
    metadata: { productId },
  });
}

export async function removeFavorite(userId: string, productId: string): Promise<void> {
  const favoriteId = buildFavoriteId(userId, productId);
  const favoriteRef = doc(db, MARKETPLACE_COLLECTIONS.FAVORITES, favoriteId);

  const existing = await getDoc(favoriteRef);
  if (!existing.exists()) return; // Já removido — idempotente

  await deleteDoc(favoriteRef);

  // Distributed counter — decrementa shard aleatório
  await incrementFavoriteShard(productId, -1);

  await createAuditLog({
    action: 'favorite_removed',
    performedBy: userId,
    targetId: favoriteId,
    targetType: 'product',
    metadata: { productId },
  });
}

export async function isFavorited(userId: string, productId: string): Promise<boolean> {
  const favoriteId = buildFavoriteId(userId, productId);
  const snap = await getDoc(doc(db, MARKETPLACE_COLLECTIONS.FAVORITES, favoriteId));
  return snap.exists();
}

export async function getUserFavorites(
  userId: string,
  pageSize = 20,
  lastDoc: DocumentSnapshot | null = null,
): Promise<{ favoriteProductIds: string[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const constraints: any[] = [
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1),
  ];

  if (lastDoc) constraints.push(startAfter(lastDoc));

  const snapshot = await getDocs(
    query(collection(db, MARKETPLACE_COLLECTIONS.FAVORITES), ...constraints),
  );

  const hasMore = snapshot.docs.length > pageSize;
  const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

  return {
    favoriteProductIds: docs.map(d => d.data().productId as string),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}
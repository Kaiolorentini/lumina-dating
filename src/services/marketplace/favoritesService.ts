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
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS } from '../../core/constants';
import { createAuditLog } from './auditService';
import { Product } from '../../shared/types/marketplace';
import { getProduct } from './productService';

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

  await setDoc(favoriteRef, {
    userId,
    productId,
    createdAt: serverTimestamp(),
  });

  // Analytics e audit — fire-and-forget
  incrementFavoriteShard(productId, 1).catch(() => {});

  createAuditLog({
    action: 'favorite_added',
    performedBy: userId,
    targetId: favoriteId,
    targetType: 'product',
    metadata: { productId },
  }).catch(() => { /* auditoria nunca bloqueia */ });
}

export async function removeFavorite(userId: string, productId: string): Promise<void> {
  const favoriteId = buildFavoriteId(userId, productId);
  const favoriteRef = doc(db, MARKETPLACE_COLLECTIONS.FAVORITES, favoriteId);

  await deleteDoc(favoriteRef);

  // Analytics e audit — fire-and-forget
  incrementFavoriteShard(productId, -1).catch(() => {});

  createAuditLog({
    action: 'favorite_removed',
    performedBy: userId,
    targetId: favoriteId,
    targetType: 'product',
    metadata: { productId },
  }).catch(() => { /* auditoria nunca bloqueia */ });
}

export async function isFavorited(userId: string, productId: string): Promise<boolean> {
  const favoriteId = buildFavoriteId(userId, productId);
  try {
    const snap = await getDoc(doc(db, MARKETPLACE_COLLECTIONS.FAVORITES, favoriteId));
    return snap.exists();
  } catch {
    return false;
  }
}

export interface FavoriteProductItem {
  productId: string;
  product: Product | null;
  favoritedAt: Timestamp | null;
}

export async function getFavoriteProducts(
  userId: string,
  pageSize = 20,
  lastDoc: DocumentSnapshot | null = null,
): Promise<{ items: FavoriteProductItem[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const constraints: Parameters<typeof query>[1][] = [
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

  const items = await Promise.all(
    docs.map(async (favoriteDoc) => {
      const data = favoriteDoc.data();
      const productId = data.productId as string;
      try {
        const product = await getProduct(productId);
        return { productId, product, favoritedAt: data.createdAt ?? null };
      } catch {
        return { productId, product: null, favoritedAt: data.createdAt ?? null };
      }
    }),
  );

  return {
    items,
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}

export async function getUserFavorites(
  userId: string,
  pageSize = 20,
  lastDoc: DocumentSnapshot | null = null,
): Promise<{ favoriteProductIds: string[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const constraints: Parameters<typeof query>[1][] = [
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1),
  ];

  if (lastDoc) constraints.push(startAfter(lastDoc));

  let snapshot;
  try {
    snapshot = await getDocs(
      query(collection(db, MARKETPLACE_COLLECTIONS.FAVORITES), ...constraints),
    );
  } catch (e: any) {
    console.error('[getUserFavorites] query failed:', e.code, e.message);
    throw e;
  }

  const hasMore = snapshot.docs.length > pageSize;
  const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

  return {
    favoriteProductIds: docs.map(d => d.data().productId as string),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}
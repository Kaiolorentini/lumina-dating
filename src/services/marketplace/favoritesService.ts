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
// Auditoria do app REMOVIDA (08/10/2026): o cliente gravava em
// auditLogs, que as regras fecham para o app — toda gravação era
// recusada e o erro engolido. Registro confiável só sai do servidor
// (Cloud Functions), e esses continuam funcionando.

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
  if (existing.exists()) return;

  await setDoc(favoriteRef, {
    userId,
    productId,
    createdAt: serverTimestamp(),
  });

  // Analytics — fire-and-forget
  incrementFavoriteShard(productId, 1).catch(() => {});
}

export async function removeFavorite(userId: string, productId: string): Promise<void> {
  const favoriteId = buildFavoriteId(userId, productId);
  const favoriteRef = doc(db, MARKETPLACE_COLLECTIONS.FAVORITES, favoriteId);

  const existing = await getDoc(favoriteRef);
  if (!existing.exists()) return;

  await deleteDoc(favoriteRef);

  // Analytics — fire-and-forget
  incrementFavoriteShard(productId, -1).catch(() => {});
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

  return {
    favoriteProductIds: docs.map(d => d.data().productId as string),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}

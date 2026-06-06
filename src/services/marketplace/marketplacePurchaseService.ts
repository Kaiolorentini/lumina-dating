// ============================================
// MARKETPLACE PURCHASE SERVICE
//
// DIFERENTE de modules/economy/purchaseService
// (que é para compra de moedas).
//
// purchaseId = buyerId + '_' + productId
//
// Responsabilidades FASE 5:
// - Verificar purchase ativa
// - Buscar purchases do comprador
// - Listener de purchases
//
// NÃO implementado (Cloud Functions FASE 6):
// - Criar purchase (feito pelo webhook)
// - Revogar purchase
// ============================================

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS } from '../../core/constants';
import { Purchase, PurchaseStatus } from '../../shared/types/marketplace';

// purchaseId = buyerId + '_' + productId
export function buildPurchaseId(buyerId: string, productId: string): string {
  return `${buyerId}_${productId}`;
}

// Verifica se o comprador tem acesso ativo ao produto
export async function hasActivePurchase(
  buyerId: string,
  productId: string,
): Promise<boolean> {
  try {
    const purchaseId = buildPurchaseId(buyerId, productId);
    const snap = await getDoc(
      doc(db, MARKETPLACE_COLLECTIONS.PURCHASES, purchaseId),
    );
    if (!snap.exists()) return false;
    const data = snap.data();
    return data.status === 'active' && !data.isRevoked;
  } catch {
    return false;
  }
}

// Busca purchase específica
export async function getPurchase(
  buyerId: string,
  productId: string,
): Promise<Purchase | null> {
  const purchaseId = buildPurchaseId(buyerId, productId);
  const snap = await getDoc(
    doc(db, MARKETPLACE_COLLECTIONS.PURCHASES, purchaseId),
  );
  if (!snap.exists()) return null;
  return {
    ...snap.data(),
    createdAt: snap.data().createdAt?.toDate() ?? new Date(),
    downloadedAt: snap.data().downloadedAt?.toDate(),
  } as Purchase;
}

// Busca purchases do comprador paginadas
export async function getBuyerPurchases(
  buyerId: string,
  pageSize = 20,
  lastDoc: DocumentSnapshot | null = null,
): Promise<{
  purchases: Purchase[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}> {
  const constraints: any[] = [
    where('buyerId', '==', buyerId),
    where('status', '==', 'active' as PurchaseStatus),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1),
  ];
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const snapshot = await getDocs(
    query(collection(db, MARKETPLACE_COLLECTIONS.PURCHASES), ...constraints),
  );

  const hasMore = snapshot.docs.length > pageSize;
  const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

  return {
    purchases: docs.map(d => ({
      ...d.data(),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
      downloadedAt: d.data().downloadedAt?.toDate(),
    } as Purchase)),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}

// Listener de purchases do comprador
export function listenToBuyerPurchases(
  buyerId: string,
  onUpdate: (purchases: Purchase[]) => void,
  limitCount = 50,
): () => void {
  const q = query(
    collection(db, MARKETPLACE_COLLECTIONS.PURCHASES),
    where('buyerId', '==', buyerId),
    where('status', '==', 'active' as PurchaseStatus),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  );

  return onSnapshot(q, snapshot => {
    onUpdate(snapshot.docs.map(d => ({
      ...d.data(),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
      downloadedAt: d.data().downloadedAt?.toDate(),
    } as Purchase)));
  }, error => {
    console.warn('[marketplacePurchaseService] listener:', error);
  });
}
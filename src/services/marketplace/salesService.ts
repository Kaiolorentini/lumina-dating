// ============================================
// SALES SERVICE — MARKETPLACE
//
// Só LEITURA de vendas no app:
// - Buscar sale por ID
// - Vendas do comprador e do vendedor (página e tempo real)
//
// Criar venda, cobrar, processar webhook, criar purchase e mexer
// em carteira é SÓ do servidor (Cloud Functions). As regras negam
// gravação em `sales` pelo app.
//
// createSale REMOVIDO (08/10/2026): nenhuma tela chamava, a regra
// recusava a gravação e a comissão era calculada no celular.
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
  onSnapshot,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS } from '../../core/constants';
import { Sale } from '../../shared/types/marketplace';

export async function getSaleById(saleId: string): Promise<Sale | null> {
  const snap = await getDoc(doc(db, MARKETPLACE_COLLECTIONS.SALES, saleId));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...snap.data(),
    createdAt: snap.data().createdAt?.toDate() ?? new Date(),
    paidAt: snap.data().paidAt?.toDate(),
    refundedAt: snap.data().refundedAt?.toDate(),
    chargebackedAt: snap.data().chargebackedAt?.toDate(),
    webhookProcessedAt: snap.data().webhookProcessedAt?.toDate(),
    expiresAt: snap.data().expiresAt?.toDate(),
  } as Sale;
}

export async function getBuyerSales(
  buyerId: string,
  pageSize = 20,
  lastDoc: DocumentSnapshot | null = null,
): Promise<{ sales: Sale[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const constraints: Parameters<typeof query>[1][] = [
    where('buyerId', '==', buyerId),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1),
  ];
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const snapshot = await getDocs(
    query(collection(db, MARKETPLACE_COLLECTIONS.SALES), ...constraints),
  );

  const hasMore = snapshot.docs.length > pageSize;
  const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

  return {
    sales: docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
      paidAt: d.data().paidAt?.toDate(),
      refundedAt: d.data().refundedAt?.toDate(),
    } as Sale)),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}

export async function getSellerSales(
  sellerId: string,
  pageSize = 20,
  lastDoc: DocumentSnapshot | null = null,
): Promise<{ sales: Sale[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const constraints: Parameters<typeof query>[1][] = [
    where('sellerId', '==', sellerId),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1),
  ];
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const snapshot = await getDocs(
    query(collection(db, MARKETPLACE_COLLECTIONS.SALES), ...constraints),
  );

  const hasMore = snapshot.docs.length > pageSize;
  const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

  return {
    sales: docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
      paidAt: d.data().paidAt?.toDate(),
    } as Sale)),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}

export function listenToBuyerSales(
  buyerId: string,
  onUpdate: (sales: Sale[]) => void,
  limitCount = 20,
): () => void {
  const q = query(
    collection(db, MARKETPLACE_COLLECTIONS.SALES),
    where('buyerId', '==', buyerId),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  );

  return onSnapshot(q, snapshot => {
    onUpdate(snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
      paidAt: d.data().paidAt?.toDate(),
    } as Sale)));
  }, error => {
    console.warn('[salesService] listenToBuyerSales:', error);
  });
}

export function listenToSellerSales(
  sellerId: string,
  onUpdate: (sales: Sale[]) => void,
  limitCount = 20,
): () => void {
  const q = query(
    collection(db, MARKETPLACE_COLLECTIONS.SALES),
    where('sellerId', '==', sellerId),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  );

  return onSnapshot(q, snapshot => {
    onUpdate(snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
      paidAt: d.data().paidAt?.toDate(),
    } as Sale)));
  }, error => {
    console.warn('[salesService] listenToSellerSales:', error);
  });
}

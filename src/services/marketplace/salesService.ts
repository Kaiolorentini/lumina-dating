// ============================================
// SALES SERVICE — MARKETPLACE
//
// Responsabilidades FASE 5 (cliente):
// - Criar sale com status pending
// - Buscar sale por ID
// - Listener de sales do comprador
// - Listener de sales do vendedor
// - Verificação de auto-compra
//
// NÃO implementado aqui (Cloud Functions FASE 6):
// - Processar pagamento
// - Atualizar status após webhook
// - Criar purchase
// - Atualizar wallet
// ============================================

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS } from '../../core/constants';
import {
  Sale,
  SaleStatus,
  PaymentMethod,
} from '../../shared/types/marketplace';
import { createAuditLog } from './auditService';
import { getAppSettings } from './appSettingsService';

// ============================================
// VALIDAÇÕES
// ============================================

function validateNotSelfPurchase(buyerId: string, sellerId: string): void {
  if (buyerId === sellerId) {
    throw new Error('Você não pode comprar seu próprio produto');
  }
}

async function validateMarketplaceEnabled(): Promise<void> {
  const settings = await getAppSettings();
  if (!settings.marketplaceEnabled) {
    throw new Error('Marketplace temporariamente indisponível');
  }
  if (settings.maintenanceMode) {
    throw new Error(settings.maintenanceMessage);
  }
}

// ============================================
// CRIAR SALE
// ============================================

interface CreateSaleInput {
  buyerId: string;
  sellerId: string;
  productId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  discountAmount?: number;
  originalAmount?: number;
}

export async function createSale(input: CreateSaleInput): Promise<string> {
  await validateMarketplaceEnabled();
  validateNotSelfPurchase(input.buyerId, input.sellerId);

  const settings = await getAppSettings();
  const platformCommission = input.amount * settings.commissionRate;
  const sellerAmount = input.amount - platformCommission;

  // Para produto gratuito — paymentMethod = 'free'
  const isFree = input.paymentMethod === 'free' || input.amount === 0;

  const saleData: Record<string, unknown> = {
    buyerId: input.buyerId,
    sellerId: input.sellerId,
    productId: input.productId,
    amount: input.amount,
    platformCommission,
    sellerAmount,
    status: 'pending' as SaleStatus,
    paymentStatus: isFree ? 'received' : 'pending',
    paymentProvider: 'asaas',
    paymentId: '',
    paymentMethod: input.paymentMethod,
    isChargebacked: false,
    webhookProcessedAt: null,
    createdAt: serverTimestamp(),
  };

  if (input.couponCode) saleData.couponCode = input.couponCode;
  if (input.discountAmount) saleData.discountAmount = input.discountAmount;
  if (input.originalAmount) saleData.originalAmount = input.originalAmount;

  const docRef = await addDoc(
    collection(db, MARKETPLACE_COLLECTIONS.SALES),
    saleData,
  );

  await createAuditLog({
    action: 'sale_created',
    performedBy: input.buyerId,
    targetId: docRef.id,
    targetType: 'sale',
    metadata: {
      productId: input.productId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
    },
  });

  return docRef.id;
}

// ============================================
// LEITURA
// ============================================

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
  const constraints: any[] = [
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
  const constraints: any[] = [
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

// ============================================
// LISTENERS
// ============================================

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
// ============================================
// ADMIN SERVICE — MARKETPLACE
//
// Operações de leitura para o painel admin.
// Nenhuma escrita direta — apenas leitura.
// Escritas ocorrem via Cloud Functions.
// ============================================

import {
  collection, doc, getDoc, getDocs, query,
  where, orderBy, limit, startAfter,
  onSnapshot, DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { COLLECTIONS, MARKETPLACE_COLLECTIONS } from '../../core/constants';
import {
  AdminMetrics, Sale, Withdrawal,
  FraudFlag, Coupon,
} from '../../shared/types/marketplace';
import { CreatorRequest } from './creatorService';
import { RefundRequest } from '../../shared/types/marketplace';
import { UserProfile } from '../../shared/types';

// Busca métricas do painel admin
export async function getAdminMetrics(): Promise<AdminMetrics | null> {
  try {
    const snap = await getDoc(
      doc(db, MARKETPLACE_COLLECTIONS.ADMIN_METRICS, 'main')
    );
    if (!snap.exists()) return null;
    return snap.data() as AdminMetrics;
  } catch {
    return null;
  }
}

// Listener de métricas em tempo real
export function listenToAdminMetrics(
  onUpdate: (metrics: AdminMetrics | null) => void
): () => void {
  return onSnapshot(
    doc(db, MARKETPLACE_COLLECTIONS.ADMIN_METRICS, 'main'),
    snap => onUpdate(snap.exists() ? snap.data() as AdminMetrics : null),
    () => onUpdate(null),
  );
}

// Busca solicitações de criadores
export async function getCreatorRequests(
  status?: 'pending' | 'approved' | 'rejected',
  pageSize = 20,
  lastDoc: DocumentSnapshot | null = null,
): Promise<{ requests: CreatorRequest[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const constraints: any[] = [];
  if (status) constraints.push(where('status', '==', status));
  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(pageSize + 1));
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const snap = await getDocs(
    query(collection(db, MARKETPLACE_COLLECTIONS.CREATOR_REQUESTS), ...constraints)
  );

  const hasMore = snap.docs.length > pageSize;
  const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

  return {
    requests: docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
      reviewedAt: d.data().reviewedAt?.toDate(),
    } as CreatorRequest)),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}

// Busca todas as vendas
export async function getAllSales(
  pageSize = 20,
  lastDoc: DocumentSnapshot | null = null,
): Promise<{ sales: Sale[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const constraints: any[] = [
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1),
  ];
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const snap = await getDocs(
    query(collection(db, MARKETPLACE_COLLECTIONS.SALES), ...constraints)
  );

  const hasMore = snap.docs.length > pageSize;
  const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

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

// Busca refund requests
export async function getRefundRequests(
  status?: string,
  pageSize = 20,
  lastDoc: DocumentSnapshot | null = null,
): Promise<{ requests: RefundRequest[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const constraints: any[] = [];
  if (status) constraints.push(where('status', '==', status));
  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(pageSize + 1));
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const snap = await getDocs(
    query(collection(db, MARKETPLACE_COLLECTIONS.REFUND_REQUESTS), ...constraints)
  );

  const hasMore = snap.docs.length > pageSize;
  const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

  return {
    requests: docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
      expiresAt: d.data().expiresAt?.toDate() ?? new Date(),
      reviewedAt: d.data().reviewedAt?.toDate(),
    } as RefundRequest)),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}

// Busca saques
export async function getWithdrawals(
  status?: string,
  pageSize = 20,
  lastDoc: DocumentSnapshot | null = null,
): Promise<{ withdrawals: Withdrawal[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const constraints: any[] = [];
  if (status) constraints.push(where('status', '==', status));
  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(pageSize + 1));
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const snap = await getDocs(
    query(collection(db, MARKETPLACE_COLLECTIONS.WITHDRAWALS), ...constraints)
  );

  const hasMore = snap.docs.length > pageSize;
  const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

  return {
    withdrawals: docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
      processedAt: d.data().processedAt?.toDate(),
    } as Withdrawal)),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}
// Busca sinalizações de fraude
export async function getFraudFlags(
  status?: string,
  pageSize = 20,
  lastDoc: DocumentSnapshot | null = null,
): Promise<{ flags: FraudFlag[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const constraints: any[] = [];
  if (status) constraints.push(where('status', '==', status));
  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(pageSize + 1));
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const snap = await getDocs(
    query(collection(db, MARKETPLACE_COLLECTIONS.FRAUD_FLAGS), ...constraints)
  );

  const hasMore = snap.docs.length > pageSize;
  const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

  return {
    flags: docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
      reviewedAt: d.data().reviewedAt?.toDate(),
    } as FraudFlag)),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}

// Busca usuário por UID
export async function getUserById(userId: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, userId));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as UserProfile;
}

// Busca usuários por nome (busca simples)
export async function searchUsers(
  searchTerm: string,
  pageSize = 10,
): Promise<UserProfile[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.USERS),
      where('name', '>=', searchTerm),
      where('name', '<=', searchTerm + '\uf8ff'),
      limit(pageSize),
    )
  );
  return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
}

// Busca screenshot events de um usuário
export async function getScreenshotEvents(userId: string): Promise<any[]> {
  const snap = await getDocs(
    query(
      collection(db, 'screenshotEvents'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20),
    )
  );
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate() ?? new Date(),
  }));
}

// Busca cupons (leitura para o painel admin)
export async function getCoupons(): Promise<Coupon[]> {
  const snap = await getDocs(
    query(
      collection(db, MARKETPLACE_COLLECTIONS.COUPONS),
      orderBy('createdAt', 'desc'),
    )
  );
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    startDate: d.data().startDate?.toDate() ?? new Date(),
    expiresAt: d.data().expiresAt?.toDate() ?? new Date(),
    createdAt: d.data().createdAt?.toDate() ?? new Date(),
    updatedAt: d.data().updatedAt?.toDate() ?? new Date(),
  } as Coupon));
}
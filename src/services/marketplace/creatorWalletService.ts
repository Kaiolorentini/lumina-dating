// ============================================
// CREATOR WALLET SERVICE — MARKETPLACE
//
// DIFERENTE de modules/economy/walletService
// (que é para moedas do app).
//
// Responsabilidades FASE 5:
// - Ler saldo do criador
// - Listener de wallet em tempo real
// - Histórico de transações paginado
// - Verificar chargeback pendente
//
// NÃO implementado (Cloud Functions FASE 6):
// - Atualizar saldo (sempre via Cloud Function)
// - Processar saque
// - Criar transação
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
import {
  CreatorWallet,
  CreatorTransaction,
  CreatorTransactionType,
} from '../../shared/types/marketplace';

// Busca wallet do criador
export async function getCreatorWallet(
  userId: string,
): Promise<CreatorWallet | null> {
  try {
    const snap = await getDoc(
      doc(db, MARKETPLACE_COLLECTIONS.CREATOR_WALLETS, userId),
    );
    if (!snap.exists()) return null;
    return {
      ...snap.data(),
      updatedAt: snap.data().updatedAt?.toDate() ?? new Date(),
    } as CreatorWallet;
  } catch (error) {
    console.warn('[creatorWalletService] getCreatorWallet:', error);
    return null;
  }
}

// Listener de wallet em tempo real
export function listenToCreatorWallet(
  userId: string,
  onUpdate: (wallet: CreatorWallet | null) => void,
): () => void {
  const ref = doc(db, MARKETPLACE_COLLECTIONS.CREATOR_WALLETS, userId);

  return onSnapshot(ref, snap => {
    if (!snap.exists()) {
      onUpdate(null);
      return;
    }
    onUpdate({
      ...snap.data(),
      updatedAt: snap.data().updatedAt?.toDate() ?? new Date(),
    } as CreatorWallet);
  }, error => {
    console.warn('[creatorWalletService] listener:', error);
    onUpdate(null);
  });
}

// Histórico de transações paginado
export async function getCreatorTransactions(
  userId: string,
  pageSize = 20,
  lastDoc: DocumentSnapshot | null = null,
  typeFilter?: CreatorTransactionType,
): Promise<{
  transactions: CreatorTransaction[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}> {
  // CORREÇÃO C2: todos os where antes do orderBy
  const constraints: any[] = [
    where('userId', '==', userId),
  ];

  // where de typeFilter ANTES do orderBy
  if (typeFilter) constraints.push(where('type', '==', typeFilter));

  // orderBy e limit APÓS todos os where
  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(pageSize + 1));

  // startAfter sempre por último
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const snapshot = await getDocs(
    query(
      collection(db, MARKETPLACE_COLLECTIONS.CREATOR_TRANSACTIONS),
      ...constraints,
    ),
  );

  const hasMore = snapshot.docs.length > pageSize;
  const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

  return {
    transactions: docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
    } as CreatorTransaction)),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}
// Verifica se há chargeback pendente (bloqueia saque)
export async function hasChargebackPending(userId: string): Promise<boolean> {
  try {
    const snap = await getDoc(
      doc(db, MARKETPLACE_COLLECTIONS.CREATOR_WALLETS, userId),
    );
    if (!snap.exists()) return false;
    return snap.data().hasChargebackPending === true;
  } catch {
    return false;
  }
}
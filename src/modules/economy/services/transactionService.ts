// ============================================
// LUMINA — TRANSACTION SERVICE v5.1
// src/modules/economy/services/transactionService.ts
//
// CORREÇÃO: coinTipo adicionado ao retorno
// para alinhar com Transaction type v5.1
// ============================================

import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';
import { Transaction } from '../../../shared/types';

export async function getTransactions(userId: string): Promise<Transaction[]> {
  const transRef = collection(
    db,
    COLLECTIONS.WALLETS,
    userId,
    COLLECTIONS.TRANSACTIONS
  );
  const q    = query(transRef, orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);

  return snap.docs.map(doc => ({
    id:          doc.id,
    type:        doc.data().type        ?? 'earn',
    coinTipo:    doc.data().coinTipo    ?? 'gratuito', // v5.1 — fallback para registros antigos
    amount:      doc.data().amount      ?? 0,
    description: doc.data().description ?? '',
    timestamp:   doc.data().timestamp?.toDate() || new Date(),
  }));
}
import {
  collection,
  query,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';
import { Transaction } from '../../../shared/types';

// Busca histórico de transações
export async function getTransactions(
  userId: string
): Promise<Transaction[]> {
  const transRef = collection(
    db,
    COLLECTIONS.WALLETS,
    userId,
    COLLECTIONS.TRANSACTIONS
  );
  const q = query(transRef, orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);

  return snap.docs.map(doc => ({
    id: doc.id,
    type: doc.data().type,
    amount: doc.data().amount,
    description: doc.data().description,
    timestamp: doc.data().timestamp?.toDate() || new Date(),
  }));
}
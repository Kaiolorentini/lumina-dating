import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS, COINS } from '../../../core/constants';
import { Wallet, Transaction } from '../../../shared/types';

// ============================================
// WALLET SERVICE — MÓDULO ECONOMY
//
// Responsabilidades:
// 1. Buscar carteira
// 2. Adicionar moedas
// 3. Gastar moedas
// 4. Registrar transações
// ============================================

// Busca ou cria carteira
export async function getWallet(userId: string): Promise<Wallet> {
  const walletRef = doc(db, COLLECTIONS.WALLETS, userId);
  const snap = await getDoc(walletRef);

  if (snap.exists()) {
    return snap.data() as Wallet;
  }

  // Cria carteira com bônus de boas-vindas
  const newWallet: Wallet = {
    coins: COINS.WELCOME_BONUS,
    totalSpent: 0,
    totalEarned: COINS.WELCOME_BONUS,
  };

  await setDoc(walletRef, newWallet);
  await addTransaction(
    userId,
    'earn',
    COINS.WELCOME_BONUS,
    '🎁 Bônus de boas-vindas'
  );

  return newWallet;
}

// Adiciona moedas
export async function addCoins(
  userId: string,
  amount: number,
  description: string
): Promise<void> {
  const walletRef = doc(db, COLLECTIONS.WALLETS, userId);
  await updateDoc(walletRef, {
    coins: increment(amount),
    totalEarned: increment(amount),
  });
  await addTransaction(userId, 'earn', amount, description);
}

// Gasta moedas — retorna false se saldo insuficiente
export async function spendCoins(
  userId: string,
  amount: number,
  description: string
): Promise<boolean> {
  const wallet = await getWallet(userId);

  if (wallet.coins < amount) return false;

  const walletRef = doc(db, COLLECTIONS.WALLETS, userId);
  await updateDoc(walletRef, {
    coins: increment(-amount),
    totalSpent: increment(amount),
  });
  await addTransaction(userId, 'spend', amount, description);
  return true;
}

// Registra transação no histórico
async function addTransaction(
  userId: string,
  type: 'earn' | 'spend',
  amount: number,
  description: string
): Promise<void> {
  const transRef = collection(
    db,
    COLLECTIONS.WALLETS,
    userId,
    COLLECTIONS.TRANSACTIONS
  );
  await addDoc(transRef, {
    type,
    amount,
    description,
    timestamp: serverTimestamp(),
  });
}
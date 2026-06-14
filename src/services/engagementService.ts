// ============================================
// SERVIÇO DE ENGAJAMENTO
//
// Apenas interações reais entre usuários.
// ============================================

import { createNotification } from '../modules/notifications/services/notificationService';
import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from '../core/firebase';
import { COLLECTIONS, COINS } from '../core/constants';

async function safeAddCoins(
  userId: string,
  amount: number,
  description: string
): Promise<void> {
  try {
    const walletRef = doc(db, COLLECTIONS.WALLETS, userId);
    await setDoc(walletRef, {
      coins: increment(amount),
      totalEarned: increment(amount),
      totalSpent: increment(0),
    }, { merge: true });
  } catch (error) {
    console.error('Erro ao adicionar moedas:', error);
  }
}

export async function onAppOpen(userId: string): Promise<void> {
  try {
    await createNotification(
      userId,
      'sintonia',
      'Bem-vindo de volta! Confira perfis compatíveis ✦'
    );
    await safeAddCoins(userId, COINS.DAILY_LOGIN, '🎁 Bônus diário de login');
    console.log('✅ App aberto — engajamento iniciado');
  } catch (error) {
    console.error('Erro no onAppOpen:', error);
  }
}
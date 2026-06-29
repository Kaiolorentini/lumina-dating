// ============================================
// LUMINA — WALLET SERVICE (CLIENT)
// src/modules/economy/services/walletService.ts
//
// v5.1 — Alinhado com novos parâmetros econômicos
//
// REGRA 1: Este arquivo NÃO credita nem debita.
// Toda operação financeira vai para Cloud Function.
// ============================================

import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../../core/firebase';
import { Wallet } from '../../../shared/types';

const functions = getFunctions();

// ------------------------------------------
// LEITURA — onSnapshot em tempo real
// ------------------------------------------
export function subscribeToWallet(
  userId: string,
  onUpdate: (wallet: Wallet) => void,
  onError?: (error: Error) => void
): () => void {
  const ref = doc(db, 'wallets', userId);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) onUpdate(snap.data() as Wallet);
    },
    (error) => {
      console.error('[walletService] subscribeToWallet error:', error);
      onError?.(error);
    }
  );
}

// ------------------------------------------
// FEATURES DISPONÍVEIS PARA GASTO
// Cliente envia feature — backend decide preço (REGRA 3B)
// ------------------------------------------
export type SpendableFeature =
  // Acessíveis com Gratuitos
  | 'REVEAL_VISITORS'
  | 'REVEAL_QUASE_SINTONIA'
  | 'REVEAL_MYSTERY_MATCH'
  | 'REVEAL_PENSOU_EM_VOCE'
  | 'IMPULSO_PERFIL'
  | 'DESTAQUE_REGIONAL'
  | 'MEGA_DESTAQUE'
  | 'SEGUNDA_CHANCE'
  | 'RECARREGAR_ENERGIA'
  | 'MOLDURA_NEBULOSA'
  | 'MOLDURA_ECLIPSE'
  | 'MOLDURA_SUPERNOVA'
  | 'PERFIL_GALAXIA'
  // Premium Only — nunca com Gratuitos
  | 'REVEAL_SINTONIA_PERDIDA'
  | 'TURBO_SINTONIA'
  | 'FERTILIZANTE_SINTONIA'
  | 'EFEITO_AURORA'
  | 'TEMA_GALAXIA'
  | 'COR_NOME_ESPECIAL'
  | 'EFEITO_ENTRADA';

interface SpendResult {
  success:             boolean;
  spent:               number;
  spentFromGratuitos:  number;
  spentFromPremium:    number;
  newBalanceGratuitos: number;
  newBalancePremium:   number;
}

// REGRA 3B: nunca enviar preço — apenas a feature
export async function spendCoins(
  feature: SpendableFeature,
  idempotencyKey?: string
): Promise<SpendResult> {
  const fn = httpsCallable<
    { feature: SpendableFeature; idempotencyKey?: string },
    SpendResult
  >(functions, 'spendCoins');
  const result = await fn({ feature, idempotencyKey });
  return result.data;
}

// ------------------------------------------
// CONVERSÃO DE FRAGMENTOS
// ------------------------------------------
export async function convertFragments(): Promise<{
  success: boolean;
  crystalsGained: number;
  fragmentsUsed: number;
  fragmentsRemaining: number;
  newBalanceGratuitos: number;
}> {
  const fn = httpsCallable(functions, 'convertFragments');
  const result = await fn({});
  return result.data as any;
}

// ------------------------------------------
// INICIALIZAÇÃO
// ------------------------------------------
export async function initWallet(): Promise<void> {
  const fn = httpsCallable(functions, 'initWallet');
  await fn({});
}

// ------------------------------------------
// HELPERS
// ------------------------------------------
export function formatCrystals(amount: number): string {
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return amount.toString();
}

export function totalBalance(wallet: Wallet): number {
  return wallet.coinsGratuitos + wallet.coinsPremium;
}

export function isPremiumOnly(feature: SpendableFeature): boolean {
  const premiumFeatures: SpendableFeature[] = [
    'REVEAL_SINTONIA_PERDIDA',
    'TURBO_SINTONIA',
    'FERTILIZANTE_SINTONIA',
    'EFEITO_AURORA',
    'TEMA_GALAXIA',
    'COR_NOME_ESPECIAL',
    'EFEITO_ENTRADA',
  ];
  return premiumFeatures.includes(feature);
}
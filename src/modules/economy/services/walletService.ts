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
  | 'PERFIL_GALAXIA'
  // Premium Only — nunca com Gratuitos
  // Molduras (FASE 5): aluguel de 30 dias, preço por raridade
  // — RARE 70, EPIC 100, LEGENDARY 150. O preço real vem do
  // COSTS no servidor; aqui só a chave.
  | 'MOLDURA_NEBULOSA'
  | 'MOLDURA_ECLIPSE'
  | 'MOLDURA_MARESIA'
  | 'MOLDURA_SUPERNOVA'
  | 'MOLDURA_AURORA'
  | 'MOLDURA_COMETA'
  | 'MOLDURA_BURACO_NEGRO'
  | 'MOLDURA_VIA_LACTEA'
  // Badges da loja (FASE 6): aluguel de 30 dias, Premium-only.
  // Só os pagos em cristais entram aqui — os de fragmentos vão
  // pela CF buyBadgeWithFragments, que não usa SpendableFeature.
  | 'BADGE_METEORO'
  | 'BADGE_PULSAR'
  | 'BADGE_BUSSOLA'
  | 'BADGE_FAROL'
  | 'BADGE_ANDARILHO'
  | 'BADGE_ESTUFA'
  | 'BADGE_ANEL_GELO'
  | 'BADGE_POEIRA_ESTELAR'
  | 'BADGE_COROA_SOLAR'
  | 'BADGE_NEBULOSA_CARMIM'
  | 'BADGE_ECLIPSE'
  | 'BADGE_CRISTAL'
  | 'BADGE_QUASAR'
  | 'BADGE_SINGULARIDADE'
  | 'BADGE_GENESE'
  | 'BADGE_VIA_LACTEA'
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
    // Molduras — FASE 5. Espelha PREMIUM_ONLY_FEATURES do
    // economy.ts; se divergir, a tela mostra um preço em
    // gratuitos que o servidor vai recusar.
    'MOLDURA_NEBULOSA',
    'MOLDURA_ECLIPSE',
    'MOLDURA_MARESIA',
    'MOLDURA_SUPERNOVA',
    'MOLDURA_AURORA',
    'MOLDURA_COMETA',
    'MOLDURA_BURACO_NEGRO',
    'MOLDURA_VIA_LACTEA',
    // Badges — FASE 6. Espelha PREMIUM_ONLY_FEATURES do
    // economy.ts; se divergir, a tela mostra preço em gratuitos
    // que o servidor vai recusar.
    'BADGE_METEORO',
    'BADGE_PULSAR',
    'BADGE_BUSSOLA',
    'BADGE_FAROL',
    'BADGE_ANDARILHO',
    'BADGE_ESTUFA',
    'BADGE_ANEL_GELO',
    'BADGE_POEIRA_ESTELAR',
    'BADGE_COROA_SOLAR',
    'BADGE_NEBULOSA_CARMIM',
    'BADGE_ECLIPSE',
    'BADGE_CRISTAL',
    'BADGE_QUASAR',
    'BADGE_SINGULARIDADE',
    'BADGE_GENESE',
    'BADGE_VIA_LACTEA',
  ];
  return premiumFeatures.includes(feature);
}
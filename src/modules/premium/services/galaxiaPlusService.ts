// ============================================
// LUMINA — GALÁXIA PLUS SERVICE
// src/modules/premium/services/galaxiaPlusService.ts
//
// Ponto ÚNICO do contrato com a CF getGalaxiaPlusStatus.
// Preço, duração e benefícios vêm SEMPRE do servidor — a loja
// anunciava R$ 19,90/mês e 10 cartas por dia enquanto a
// cobrança era R$ 24,99 único e o servidor dava 4 cartas.
// Número escrito à mão numa tela é promessa que diverge.
// ============================================

import { getFunctions, httpsCallable } from 'firebase/functions';

export interface GalaxiaPlusStatus {
  active:         boolean;
  expiresAt:      string | null;
  daysLeft:       number;
  everSubscribed: boolean;
  totalRenewals:  number;
  price:          number;
  duration:       number;
  grants: {
    crystals: number;
    turbos:   number;
    badge:    string;
    renewalFragments: number;
  };
  benefits: {
    destinyCards: { perDay: number; usedToday: number; left: number; totalDrawn: number };
    turbos:       { granted: number; used: number; available: number };
    faisca:       { bonusPercent: number; crystalsEarned: number };
    visitors:     { normalCost: number; timesRevealed: number; crystalsSaved: number };
    vault:        { instantWithdraws: number; crystalsFromInstant: number };
  };
}

export async function fetchGalaxiaPlusStatus(): Promise<GalaxiaPlusStatus> {
  const callable = httpsCallable<void, GalaxiaPlusStatus>(getFunctions(), 'getGalaxiaPlusStatus');
  const result = await callable();
  return result.data;
}

/** 24.99 → "24,99". null quando o valor não veio. */
export function formatPrice(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value.toFixed(2).replace('.', ',');
}

/**
 * Benefícios em texto, montados SÓ com o que o servidor
 * devolveu. Usado pela loja e pela tela de pacotes — uma lista
 * escrita à mão em cada tela foi o que deixou as duas
 * anunciando 10 cartas e "300 cristais gratuitos todo mês".
 */
export function galaxiaPlusBenefitLines(status: GalaxiaPlusStatus): string[] {
  const b = status.benefits;
  const g = status.grants;
  return [
    `🃏 ${b.destinyCards.perDay} Cartas do Destino grátis por dia`,
    `⚡ ${g.turbos} Turbos Sintonia na ativação`,
    `💎 ${g.crystals} cristais premium na ativação`,
    `✨ Faísca com bônus de +${b.faisca.bonusPercent}%`,
    '👀 Ver quem visitou, sem gastar cristais',
    '🗝️ Saque do Cofre sem as 48h de espera',
    '🏅 Badge Constelação Guia na primeira ativação',
  ];
}
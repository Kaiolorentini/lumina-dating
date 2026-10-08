// ============================================
// LUMINA — VENCIMENTO DE BOOST NOS CARDS
// src/shared/utils/boostExpiry.ts
//
// As listas de perfis são buscadas uma vez por sessão. Um boost
// que vence com a tela aberta continuaria com selo (e no topo)
// até a próxima busca. Estas funções retiram o boost vencido do
// card SEM nova leitura.
//
// Todas devolvem o MESMO array quando nada venceu — o setState
// com a mesma referência não re-renderiza.
// ============================================

import { ProfileCardData } from '../types';

function isExpired(card: ProfileCardData, now: number): boolean {
  return !!card.boostType && typeof card.boostUntil === 'number' && card.boostUntil <= now;
}

/** Algum card com boost que ainda pode vencer nesta sessão. */
export function hasTimedBoost(cards: ProfileCardData[]): boolean {
  return cards.some(c => !!c.boostType && typeof c.boostUntil === 'number');
}

/** Tira só o selo; o card fica onde está. */
export function clearExpiredBoosts(cards: ProfileCardData[], now: number): ProfileCardData[] {
  if (!cards.some(c => isExpired(c, now))) return cards;
  return cards.map(c => (isExpired(c, now) ? { ...c, boostType: null, boostUntil: null } : c));
}

/** Tira o card inteiro — para seções que só existem por causa do boost. */
export function removeExpiredBoosts(cards: ProfileCardData[], now: number): ProfileCardData[] {
  if (!cards.some(c => isExpired(c, now))) return cards;
  return cards.filter(c => !isExpired(c, now));
}

/**
 * Tira o selo e DESCE o card do bloco fixado no topo para a
 * posição pela sintonia. Os demais cards não mudam de lugar —
 * quem está rolando não perde a posição.
 */
export function expireAndUnpin(cards: ProfileCardData[], now: number): ProfileCardData[] {
  const expired: ProfileCardData[] = [];
  const kept: ProfileCardData[] = [];

  for (const card of cards) {
    if (isExpired(card, now)) expired.push({ ...card, boostType: null, boostUntil: null });
    else kept.push(card);
  }

  if (expired.length === 0) return cards;

  // Bloco fixado: os primeiros cards que ainda têm boost.
  let pinned = 0;
  while (pinned < kept.length && kept[pinned].boostType) pinned++;

  const result = kept.slice();
  for (const card of expired) {
    let index = pinned;
    while (index < result.length && result[index].sintonia >= card.sintonia) index++;
    result.splice(index, 0, card);
  }
  return result;
}
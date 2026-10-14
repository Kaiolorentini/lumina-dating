// ============================================
// LUMINA — SUGESTÕES DE PRIMEIRA MENSAGEM
// src/modules/chat/utils/chatSuggestions.ts
//
// Frases prontas para quebrar o gelo, montadas a partir dos
// interesses em COMUM das duas pessoas (só os rótulos do catálogo:
// nada do texto do perfil, nada de dado sensível). Sem interesse em
// comum, frases neutras. Tocar numa sugestão só PREENCHE o campo —
// a pessoa sempre revisa antes de enviar.
//
// Determinístico (mesma dupla → mesmas frases): a lista não muda a
// cada renderização.
// ============================================

import { interestLabel } from '../../../config/sintonia/interestsCatalog';

const WITH_INTEREST: Array<(label: string) => string> = [
  label => `Vi que você também curte ${label.toLowerCase()}! Como começou?`,
  label => `${label} em comum ✦ Qual é a sua indicação favorita?`,
  label => `Oi! ${label} é uma das minhas coisas favoritas. E pra você?`,
];

const NEUTRAL = [
  'Oi! Seu perfil chamou minha atenção ✦',
  'Qual seria o plano perfeito de fim de semana pra você?',
  'Me conta uma coisa que sempre te faz sorrir 😊',
];

/** Até 3 sugestões. `commonIds`: ids de interesse em comum. */
export function buildChatSuggestions(commonIds: string[]): string[] {
  const labels = commonIds.map(interestLabel).filter(Boolean).slice(0, 3);
  if (labels.length === 0) return NEUTRAL;
  const out = labels.map((label, i) => WITH_INTEREST[i % WITH_INTEREST.length](label));
  // Completa com neutras quando há só 1 ou 2 em comum.
  for (const n of NEUTRAL) {
    if (out.length >= 3) break;
    out.push(n);
  }
  return out;
}

/** Faixa do topo: "Em comum: Praia, Pagode e samba". */
export function commonInterestsBanner(commonIds: string[]): string | undefined {
  const labels = commonIds.map(interestLabel).filter(Boolean).slice(0, 4);
  if (labels.length === 0) return undefined;
  const list = labels.length === 1
    ? labels[0]
    : `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
  return `✦ Em comum: ${list}`;
}

// ============================================
// LUMINA — GUARD DE BOOST ÚNICO v1.0
// functions/src/premium/utils/assertSingleBoost.ts
//
// REGRA: apenas UM boost de visibilidade ativo por vez.
// Turbo Sintonia · Impulso de Perfil · Destaque Regional
// são mutuamente exclusivos.
//
// MOTIVO: getActiveBoostScore() no usersService SOMA os três
// campos. Sem esta trava, Turbo (180) + Impulso (120) = 300 —
// o usuário compra vantagem cumulativa que a economia não previu,
// e o badge da Home fica ambíguo (dois boosts, um slot visual).
//
// USO OBRIGATÓRIO: chamar DENTRO do runTransaction, com o
// userData lido via t.get(userRef). Validar fora da transaction
// não protege contra R5 (race condition) — dois cliques rápidos
// passam pelos dois checks antes de qualquer write.
//
// Ao adicionar um novo boost de visibilidade, incluir o campo
// em BOOST_FIELDS. É o único lugar que precisa mudar.
// ============================================

import { HttpsError } from 'firebase-functions/v2/https';

// Campos em users/{uid} que representam boost de visibilidade.
// A ordem define a prioridade de exibição do badge na Home.
export const BOOST_FIELDS = ['turbo', 'destaqueRegional', 'impulso'] as const;

export type BoostField = (typeof BOOST_FIELDS)[number];

const BOOST_LABELS: Record<BoostField, string> = {
  turbo:            'Turbo Sintonia',
  destaqueRegional: 'Destaque Regional',
  impulso:          'Impulso de Perfil',
};

interface ActiveBoost {
  field:        BoostField;
  label:        string;
  expiresAt:    Date;
  remainingMin: number;
}

/**
 * Retorna o boost ativo, ou null. Não lança.
 * Útil para telas de status e para o badge da Home.
 */
export function findActiveBoost(
  userData: Record<string, any> | undefined,
  now: Date,
): ActiveBoost | null {
  for (const field of BOOST_FIELDS) {
    const expiresAt: Date | null = userData?.[field]?.expiresAt?.toDate?.() ?? null;

    if (!expiresAt || expiresAt <= now) continue;

    return {
      field,
      label:        BOOST_LABELS[field],
      expiresAt,
      remainingMin: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 60000)),
    };
  }

  return null;
}

/**
 * Lança se QUALQUER boost de visibilidade estiver ativo.
 *
 * @param userData   users/{uid} lido dentro da transaction
 * @param now        instante server-side (nunca vindo do cliente — R6)
 * @param requesting campo que o usuário está tentando ativar agora
 */
export function assertSingleBoost(
  userData: Record<string, any> | undefined,
  now: Date,
  requesting: BoostField,
): void {
  const active = findActiveBoost(userData, now);

  if (!active) return;

  // Mesmo boost: mensagem de "já ativo" (mantém o contrato
  // already-exists que o frontend do Turbo já trata).
  if (active.field === requesting) {
    throw new HttpsError(
      'already-exists',
      `${active.label} já ativo. Restam ${active.remainingMin} min.`,
    );
  }

  // Boost diferente: explica a exclusividade.
  throw new HttpsError(
    'failed-precondition',
    `Você já tem ${active.label} ativo (restam ${active.remainingMin} min). ` +
      'É possível manter apenas um destaque por vez — aguarde o término para ativar outro.',
  );
}

/**
 * Formata o boost ativo para consumo do cliente nas funções
 * de status (getTurboStatus, getImpulsoStatus, etc.).
 */
export function serializeActiveBoost(active: ActiveBoost | null) {
  if (!active) {
    return { hasActiveBoost: false, activeBoostField: null, activeBoostLabel: null };
  }

  return {
    hasActiveBoost:       true,
    activeBoostField:     active.field,
    activeBoostLabel:     active.label,
    activeBoostExpiresAt: active.expiresAt.toISOString(),
  };
}
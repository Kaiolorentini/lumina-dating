// ============================================
// LUMINA — SINTONIA CALCULATOR v2
// src/modules/ai/services/sintoniaCalculator.ts
//
// 12/10/2026 — SINTONIA v2. O cálculo saiu daqui e foi para
// src/config/sintonia/sintoniaFormula.ts, ESPELHO IDÊNTICO da fórmula
// do servidor (functions/src/config/sintoniaFormula.ts). Este arquivo
// só acrescenta rótulo, cor e marco — e mantém o nome
// calcularSintonia, usado pelo feed, Sintonize, perfil e Em Alta.
//
// O que mudou para quem usa o app:
//   • a nota é a MESMA para os dois lados;
//   • sem interesse dos dois lados, fica no máximo em 35%;
//   • localização pelo código IBGE;
//   • interesses de verdade (lista do perfil), não preenchimento;
//   • o número do perfil é o mesmo dos pushes e da Carta do Destino.
// ============================================

import { UserProfile } from '../../../shared/types';
import {
  getSintoniaLabel,
  getSintoniaColor,
  getSintoniaMilestone,
} from '../../../shared/utils/sintonia';
import {
  MutualInterest, SINTONIA_WEIGHTS, computeSintonia,
} from '../../../config/sintonia/sintoniaFormula';

export interface SintoniaBreakdown {
  interesseMutuo: number;
  idade: number;
  localizacao: number;
  interesses: number;
  /** false quando um dos dois ainda não escolheu interesses. */
  interestsKnown: boolean;
  commonInterests: string[];
  mutual: MutualInterest;
  /** Nota limitada a 35% por falta de interesse mútuo. */
  capped: boolean;
}

export const SINTONIA_BREAKDOWN_MAX = SINTONIA_WEIGHTS;

export const EMPTY_SINTONIA_BREAKDOWN: SintoniaBreakdown = {
  interesseMutuo: 0, idade: 0, localizacao: 0, interesses: 0,
  interestsKnown: false, commonInterests: [], mutual: 'none', capped: false,
};

export interface SintoniaResult {
  score: number;
  label: string;
  color: string;
  milestone: string;
  breakdown: SintoniaBreakdown;
}

export function calcularSintonia(
  user: Partial<UserProfile>,
  target: Partial<UserProfile>,
): SintoniaResult {
  const { score, parts } = computeSintonia(user, target);
  return {
    score,
    label: getSintoniaLabel(score),
    color: getSintoniaColor(score),
    milestone: getSintoniaMilestone(score),
    breakdown: {
      interesseMutuo:  parts.interesseMutuo,
      idade:           parts.idade,
      localizacao:     parts.localizacao,
      interesses:      parts.interesses,
      interestsKnown:  parts.interestsKnown,
      commonInterests: parts.commonInterests,
      mutual:          parts.mutual,
      capped:          parts.capped,
    },
  };
}

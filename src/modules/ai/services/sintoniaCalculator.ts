import { UserProfile } from '../../../shared/types';
import { SINTONIA } from '../../../core/constants';
import {
  getSintoniaLabel,
  getSintoniaColor,
  getSintoniaMilestone,
} from '../../../shared/utils/sintonia';

// ============================================
// SINTONIA CALCULATOR
//
// Cálculo de compatibilidade entre usuários reais.
// Sem Firebase. Sem side effects.
// ============================================

export interface SintoniaBreakdown {
  localizacao: number;
  preferencia: number;
  perfil: number;
  interesses: number;
}

export interface SintoniaResult {
  score: number;
  label: string;
  color: string;
  milestone: string;
  breakdown: SintoniaBreakdown;
}

function calcLocalizacao(
  userCity: string,
  userState: string,
  targetCity: string,
  targetState: string
): number {
  const sameCity = userCity.toLowerCase().trim() === targetCity.toLowerCase().trim();
  const sameState = userState.toLowerCase().trim() === targetState.toLowerCase().trim();
  if (sameCity && sameState) return 25;
  if (sameState) return 15;
  return 5;
}

function calcPreferencia(
  userGender: string,
  userPrefs: string[],
  targetGender: string,
  targetPrefs: string[]
): number {
  const genderMap: Record<string, string> = {
    masculino: 'homens',
    feminino: 'mulheres',
    trans: 'trans',
    'nao-binario': 'todos',
  };

  const userMatchTarget =
    targetPrefs.includes(genderMap[userGender]) || targetPrefs.includes('todos');
  const targetMatchUser =
    userPrefs.includes(genderMap[targetGender]) || userPrefs.includes('todos');

  if (userMatchTarget && targetMatchUser) return 35;
  if (userMatchTarget || targetMatchUser) return 20;
  return 0;
}

function calcPerfil(
  userAge: number,
  targetAge: number,
  hasPhoto: boolean,
  hasBio: boolean
): number {
  let score = 0;
  const diff = Math.abs(userAge - targetAge);
  if (diff <= 3) score += 15;
  else if (diff <= 7) score += 10;
  else if (diff <= 12) score += 5;
  else score += 2;
  if (hasPhoto) score += 5;
  if (hasBio) score += 5;
  return score;
}

function calcInteresses(target: Partial<UserProfile>): number {
  let score = 0;
  if (target.name) score += 3;
  if (target.age) score += 3;
  if (target.city) score += 3;
  if (target.bio && target.bio.length > 20) score += 3;
  if (target.photoURL) score += 3;
  return Math.min(score, 15);
}

export function calcularSintonia(
  user: Partial<UserProfile>,
  target: Partial<UserProfile>
): SintoniaResult {
  if (!user.city || !target.city || !user.gender || !target.gender) {
    return {
      score: SINTONIA.BASE_SCORE,
      label: getSintoniaLabel(SINTONIA.BASE_SCORE),
      color: getSintoniaColor(SINTONIA.BASE_SCORE),
      milestone: getSintoniaMilestone(SINTONIA.BASE_SCORE),
      breakdown: { localizacao: 10, preferencia: 20, perfil: 10, interesses: 10 },
    };
  }

  const localizacao = calcLocalizacao(
    user.city, user.state || '',
    target.city, target.state || ''
  );
  const preferencia = calcPreferencia(
    user.gender, user.preferences || [],
    target.gender, target.preferences || []
  );
  const perfil = calcPerfil(
    user.age || 25, target.age || 25,
    !!target.photoURL, !!target.bio
  );
  const interesses = calcInteresses(target);
  const score = Math.min(localizacao + preferencia + perfil + interesses, SINTONIA.MAX_SCORE);

  return {
    score,
    label: getSintoniaLabel(score),
    color: getSintoniaColor(score),
    milestone: getSintoniaMilestone(score),
    breakdown: { localizacao, preferencia, perfil, interesses },
  };
}
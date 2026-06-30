// ============================================
// LUMINA — RANKING CALCULATOR v1.0
// functions/src/gamification/calculators/RankingCalculator.ts
//
// SPRINT 1C — Função pura. Sem Firestore. Sem Transactions.
// ============================================

const SOCIAL_RANKING_CATEGORIES = ['SOCIAL', 'MISSION', 'CHAT'];

const LEAGUES = [
  { name: 'Galáxia',     minXP: 5000 },
  { name: 'Constelação', minXP: 2000 },
  { name: 'Ouro',        minXP: 1000 },
  { name: 'Prata',       minXP: 500  },
  { name: 'Bronze',      minXP: 0    },
];

function getLeague(xp: number): string {
  for (const league of LEAGUES) {
    if (xp >= league.minXP) return league.name;
  }
  return 'Bronze';
}

export interface RankingCalculatorInput {
  category:          string;
  xpAmount:          number;
  currentSocialXP:   number;
  currentWeeklyXP:   number;
  frozen:            boolean;
}

export interface RankingCalculatorOutput {
  socialXP: number;
  weeklyXP: number;
  league:   string;
}

export function calculateRanking(input: RankingCalculatorInput): RankingCalculatorOutput | null {
  if (input.frozen) return null;
  if (input.xpAmount <= 0) return null;

  const isSocial   = SOCIAL_RANKING_CATEGORIES.includes(input.category);
  const newSocialXP = input.currentSocialXP + (isSocial ? input.xpAmount : 0);
  const newWeeklyXP  = input.currentWeeklyXP + input.xpAmount;

  return { socialXP: newSocialXP, weeklyXP: newWeeklyXP, league: getLeague(newSocialXP) };
}
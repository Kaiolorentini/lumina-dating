// ============================================
// LUMINA — XP TABLE v6.0
// functions/src/config/xpTable.ts
//
// REGRA 12: Tabela de níveis configurável
// REGRA 26: Separado de xpValues e treeTable
//
// v6.0 — CURVA CONTÍNUA DE 1 A 50 E RECOMPENSAS DE NÍVEL.
//
// A tabela antiga pulava do 10 para o 15, 20, 30 e 50 — a barra
// ficava parada semanas e o número saltava. E do 5 ao 9 subia a
// cada 500 XP, rápido demais.
//
// Agora o XP total do nível n é:
//     T(n) = A·(n−1) + B·(n−1)²   (arredondado para dezenas)
// com T(2) = 100 e T(50) = 36.000. Os primeiros níveis vêm
// rápido; cada um custa um pouco mais que o anterior.
//
// Referência — jogador diário (~200 XP/dia):
//   nível 10 ~9 dias · 20 ~1 mês · 30 ~2,3 meses
//   40 ~4 meses · 50 ~6 meses
// O teto de 400 XP/dia (DAILY_XP_MAX) impede qualquer conta de
// chegar ao 50 em menos de ~3 meses — o 50 paga cristais PREMIUM.
// ============================================

export interface LevelDef {
  level:       number;
  xpRequired:  number;
  tier:        string;
}

export const MAX_LEVEL = 50;

const XP_AT_LEVEL_2  = 100;
const XP_AT_LEVEL_50 = 36000;

// Resolve A e B para as duas âncoras acima.
const B = (XP_AT_LEVEL_50 - XP_AT_LEVEL_2 * (MAX_LEVEL - 1)) /
          ((MAX_LEVEL - 1) * (MAX_LEVEL - 1) - (MAX_LEVEL - 1));
const A = XP_AT_LEVEL_2 - B;

function xpRequiredFor(level: number): number {
  if (level <= 1) return 0;
  const k = level - 1;
  return Math.round((A * k + B * k * k) / 10) * 10;
}

function tierFor(level: number): string {
  if (level >= 30) return '💜 Galáxia';
  if (level >= 10) return '✨ Lendário';
  if (level >= 5)  return '🌸 Épico';
  if (level >= 3)  return '🌿 Raro';
  return '🌱 Comum';
}

// REGRA 12: gerada, não digitada — não tem como ter buraco.
export const XP_LEVEL_TABLE: LevelDef[] = Array.from({ length: MAX_LEVEL }, (_, i) => {
  const level = i + 1;
  return { level, xpRequired: xpRequiredFor(level), tier: tierFor(level) };
});

// REGRA 11: level sempre derivado do totalXP
export function calcLevel(totalXP: number): {
  level:       number;
  tier:        string;
  nextLevelXP: number;
  progress:    number;  // 0-1
} {
  let current = XP_LEVEL_TABLE[0];
  let next    = XP_LEVEL_TABLE[1] ?? XP_LEVEL_TABLE[0];

  for (let i = 0; i < XP_LEVEL_TABLE.length; i++) {
    if (totalXP >= XP_LEVEL_TABLE[i].xpRequired) {
      current = XP_LEVEL_TABLE[i];
      next    = XP_LEVEL_TABLE[i + 1] ?? XP_LEVEL_TABLE[i];
    } else break;
  }

  const xpInLevel = totalXP - current.xpRequired;
  const xpForNext = next.xpRequired - current.xpRequired;
  const progress  = xpForNext > 0 ? Math.min(xpInLevel / xpForNext, 1) : 1;

  return { level: current.level, tier: current.tier, nextLevelXP: next.xpRequired, progress };
}

// ============================================
// RECOMPENSAS DE NÍVEL — fidelidade de longo prazo
// ============================================
//
// A cada 10 níveis, fragmentos no COFRE (10 → 300). Do 46 ao 50,
// cristais PREMIUM (25 → 150): ~400 no total, só para quem joga
// de 5 a 6 meses. Não compete com a compra — recompensa quem fica.
//
// Todo marco gera modal de comemoração.
//
// Cada recompensa é paga UMA vez: o nível deriva do totalXP, que
// só cresce, então cada nível é atravessado uma única vez.
// Subindo vários níveis de uma vez, todos os marcos atravessados
// são pagos.

export interface LevelReward {
  level:           number;
  fragments:       number;  // vão para o Cofre
  crystalsPremium: number;
}

export const LEVEL_REWARDS: LevelReward[] = [
  { level: 10, fragments: 10,  crystalsPremium: 0   },
  { level: 20, fragments: 50,  crystalsPremium: 0   },
  { level: 30, fragments: 100, crystalsPremium: 0   },
  { level: 40, fragments: 200, crystalsPremium: 0   },
  { level: 46, fragments: 0,   crystalsPremium: 25  },
  { level: 47, fragments: 0,   crystalsPremium: 50  },
  { level: 48, fragments: 0,   crystalsPremium: 75  },
  { level: 49, fragments: 0,   crystalsPremium: 100 },
  { level: 50, fragments: 300, crystalsPremium: 150 },
];

/** Marcos atravessados ao sair de `fromLevel` e chegar em `toLevel`. */
export function levelRewardsBetween(fromLevel: number, toLevel: number): LevelReward[] {
  return LEVEL_REWARDS.filter(r => r.level > fromLevel && r.level <= toLevel);
}
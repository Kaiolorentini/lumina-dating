// ============================================
// LUMINA — XP TABLE v5.2
// functions/src/config/xpTable.ts
//
// REGRA 12: Tabela de níveis configurável
// REGRA 26: Separado de xpValues e treeTable
// ============================================

export interface LevelDef {
  level:       number;
  xpRequired:  number;
  tier:        string;
}

// REGRA 12: Alterar aqui sem tocar na lógica
export const XP_LEVEL_TABLE: LevelDef[] = [
  { level: 1,  xpRequired: 0,     tier: '🌱 Comum'    },
  { level: 2,  xpRequired: 100,   tier: '🌱 Comum'    },
  { level: 3,  xpRequired: 250,   tier: '🌿 Raro'     },
  { level: 4,  xpRequired: 500,   tier: '🌿 Raro'     },
  { level: 5,  xpRequired: 1500,  tier: '🌸 Épico'    },
  { level: 6,  xpRequired: 2500,  tier: '🌸 Épico'    },
  { level: 7,  xpRequired: 3500,  tier: '🌸 Épico'    },
  { level: 8,  xpRequired: 4000,  tier: '🌸 Épico'    },
  { level: 9,  xpRequired: 4500,  tier: '🌸 Épico'    },
  { level: 10, xpRequired: 5000,  tier: '✨ Lendário'  },
  { level: 15, xpRequired: 10000, tier: '✨ Lendário'  },
  { level: 20, xpRequired: 15000, tier: '✨ Lendário'  },
  { level: 30, xpRequired: 30000, tier: '💜 Galáxia'  },
  { level: 50, xpRequired: 60000, tier: '💜 Galáxia'  },
];

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
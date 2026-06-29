// ============================================
// LUMINA — XP VALUES v5.2
// functions/src/config/xpValues.ts
//
// REGRA 26: xpValues.ts separado de xpTable.ts
// Alterar valores de XP sem tocar em lógica.
// REGRA 14: treeXP separado — só ações sociais reais
// ============================================

import { XPCategory } from './xpMultipliers';

export interface XPActionDef {
  xp:         number;       // XP global
  treeXP:     number;       // XP da Árvore (só conexões reais)
  category:   XPCategory;
  dailyMax:   number;       // máx XP desta ação/dia (0 = sem limite)
  perUser:    boolean;      // 1x por usuário alvo/dia
  minMessages?: number;     // mínimo de mensagens (REGRA 6)
}

// REGRA 14 + última recomendação:
// treeXP só para conexões humanas reais
// Visita, curtida, missão comum → NÃO alimentam a árvore
// Sintonia, conversa real, missão social → alimentam a árvore
export const XP_ACTION_VALUES: Record<string, XPActionDef> = {
  VISIT_PROFILE:       { xp: 1,  treeXP: 0,  category: 'SOCIAL',      dailyMax: 20,  perUser: true                },
  GIVE_LIKE:           { xp: 3,  treeXP: 0,  category: 'SOCIAL',      dailyMax: 30,  perUser: true                },
  RECEIVE_LIKE:        { xp: 5,  treeXP: 0,  category: 'SOCIAL',      dailyMax: 100, perUser: true                },
  START_CONVO:         { xp: 10, treeXP: 5,  category: 'SOCIAL',      dailyMax: 50,  perUser: true, minMessages: 2 },
  CREATE_SINTONIA:     { xp: 20, treeXP: 20, category: 'SOCIAL',      dailyMax: 0,   perUser: true                },
  COMPLETE_MISSION:    { xp: 15, treeXP: 0,  category: 'MISSION',     dailyMax: 0,   perUser: false               },
  COMPLETE_SOCIAL_MISSION: { xp: 15, treeXP: 5, category: 'MISSION',  dailyMax: 0,   perUser: false               },
  UNLOCK_ACHIEVEMENT:  { xp: 30, treeXP: 10, category: 'ACHIEVEMENT', dailyMax: 0,   perUser: false               },
};

export const DAILY_XP_MAX = 300; // REGRA 5 — teto global
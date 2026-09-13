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
// v5.3 — REBALANCEAMENTO
//
// XP global subiu ~2x: com os valores antigos, uma sessão típica
// (5 visitas, 3 curtidas, 1 conversa) rendia 30 XP — 3 dias para
// sair do nível 1. Agora rende ~65.
//
// treeXP subiu mais: a árvore era matematicamente inviável.
// Estágio 4 exigia 1.500 treeXP = 75 sintonias distintas. Com os
// novos valores são ~30, e o estágio 1 sai em 3 sintonias.
// A regra 14 se mantém — só conexão humana real alimenta a árvore.
export const XP_ACTION_VALUES: Record<string, XPActionDef> = {
  VISIT_PROFILE:       { xp: 2,  treeXP: 0,  category: 'SOCIAL',      dailyMax: 40,  perUser: true                },
  GIVE_LIKE:           { xp: 5,  treeXP: 0,  category: 'SOCIAL',      dailyMax: 50,  perUser: true                },
  RECEIVE_LIKE:        { xp: 8,  treeXP: 0,  category: 'SOCIAL',      dailyMax: 120, perUser: true                },
  START_CONVO:         { xp: 20, treeXP: 15, category: 'SOCIAL',      dailyMax: 80,  perUser: true, minMessages: 2 },
  CREATE_SINTONIA:     { xp: 50, treeXP: 50, category: 'SOCIAL',      dailyMax: 0,   perUser: true                },
  COMPLETE_MISSION:    { xp: 25, treeXP: 0,  category: 'MISSION',     dailyMax: 0,   perUser: false               },
  COMPLETE_SOCIAL_MISSION: { xp: 25, treeXP: 10, category: 'MISSION', dailyMax: 0,   perUser: false               },
  UNLOCK_ACHIEVEMENT:  { xp: 50, treeXP: 20, category: 'ACHIEVEMENT', dailyMax: 0,   perUser: false               },
};

export const DAILY_XP_MAX = 400; // REGRA 5 — teto global
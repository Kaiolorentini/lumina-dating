// ============================================
// LUMINA — ACHIEVEMENTS CATALOG v5.1
// functions/src/config/achievementsCatalog.ts
//
// REGRA 6:  Categorias como enum
// REGRA 7:  Sistema de raridade
// REGRA 9:  Estrutura de recompensas extensível
// REGRA 10: Conquistas secretas (hidden)
// REGRA 17: Campo title reservado
// REGRA 18: Coleção Fundador
// REGRA 19: Coleção Premium
// ============================================

export type AchievementCategory =
  | 'SOCIAL'
  | 'EXPLORER'
  | 'MISSION'
  | 'STREAK'
  | 'TREE'
  | 'VAULT'
  | 'CHAT'
  | 'SPECIAL'
  | 'EVENT'
  | 'FOUNDER'   // REGRA 18
  | 'PREMIUM';  // REGRA 19

export type AchievementRarity =
  | 'COMMON'
  | 'RARE'
  | 'EPIC'
  | 'LEGENDARY'
  | 'MYTHIC';

export interface AchievementDef {
  id:          string;
  title:       string;
  description: string;
  category:    AchievementCategory;
  rarity:      AchievementRarity;
  icon:        string;
  hidden:      boolean;           // REGRA 10 — conquistas secretas
  version:     number;            // REGRA 5 — versionamento
  target:      number;            // meta para desbloquear
  reward: {                       // REGRA 9 — extensível
    xp:        number;
    fragments: number;
    badge:     string | null;
    frame:     string | null;
    title:     string | null;     // REGRA 17
  };
}

// ── CATÁLOGO COMPLETO ──
export const ACHIEVEMENTS_CATALOG: Record<string, AchievementDef> = {

  // ── SOCIAL ──
  FIRST_SINTONIA: {
    id: 'FIRST_SINTONIA', title: 'Primeira Sintonia', description: 'Crie sua primeira Sintonia',
    category: 'SOCIAL', rarity: 'COMMON', icon: '✨', hidden: false, version: 1, target: 1,
    reward: { xp: 30, fragments: 0, badge: 'badge_first_sintonia', frame: null, title: null },
  },
  SINTONIA_10: {
    id: 'SINTONIA_10', title: 'Conectado', description: 'Crie 10 Sintonias',
    category: 'SOCIAL', rarity: 'RARE', icon: '💜', hidden: false, version: 1, target: 10,
    reward: { xp: 30, fragments: 50, badge: 'badge_conectado', frame: null, title: 'Conectado' },
  },
  SINTONIA_50: {
    id: 'SINTONIA_50', title: 'Alma Social', description: 'Crie 50 Sintonias',
    category: 'SOCIAL', rarity: 'EPIC', icon: '💫', hidden: false, version: 1, target: 50,
    reward: { xp: 30, fragments: 100, badge: 'badge_alma_social', frame: 'frame_social', title: 'Alma Social' },
  },
  SINTONIA_PERFEITA: {
    id: 'SINTONIA_PERFEITA', title: 'Sintonia Perfeita', description: 'Crie uma Sintonia com 95%+ de compatibilidade',
    category: 'SOCIAL', rarity: 'LEGENDARY', icon: '👑', hidden: true, version: 1, target: 1,
    reward: { xp: 30, fragments: 0, badge: 'badge_sintonia_perfeita', frame: null, title: 'Alma Gêmea' },
  },

  // ── EXPLORER ──
  EXPLORER_10: {
    id: 'EXPLORER_10', title: 'Curioso', description: 'Visite 10 perfis',
    category: 'EXPLORER', rarity: 'COMMON', icon: '👁️', hidden: false, version: 1, target: 10,
    reward: { xp: 30, fragments: 0, badge: null, frame: null, title: null },
  },
  EXPLORER_50: {
    id: 'EXPLORER_50', title: 'Explorador', description: 'Visite 50 perfis',
    category: 'EXPLORER', rarity: 'RARE', icon: '🔭', hidden: false, version: 1, target: 50,
    reward: { xp: 30, fragments: 30, badge: 'badge_explorador', frame: null, title: null },
  },
  EXPLORER_100: {
    id: 'EXPLORER_100', title: 'Grande Explorador', description: 'Visite 100 perfis',
    category: 'EXPLORER', rarity: 'EPIC', icon: '🌌', hidden: false, version: 1, target: 100,
    reward: { xp: 30, fragments: 80, badge: 'badge_grande_explorador', frame: 'frame_explorer', title: 'Explorador' },
  },

  // ── MISSION ──
  MISSION_7: {
    id: 'MISSION_7', title: 'Dedicado', description: 'Complete 7 missões',
    category: 'MISSION', rarity: 'COMMON', icon: '📋', hidden: false, version: 1, target: 7,
    reward: { xp: 30, fragments: 20, badge: null, frame: null, title: null },
  },
  MISSION_30: {
    id: 'MISSION_30', title: 'Comprometido', description: 'Complete 30 missões',
    category: 'MISSION', rarity: 'RARE', icon: '🎯', hidden: false, version: 1, target: 30,
    reward: { xp: 30, fragments: 60, badge: 'badge_comprometido', frame: null, title: null },
  },
  MISSION_100: {
    id: 'MISSION_100', title: 'Mestre das Missões', description: 'Complete 100 missões',
    category: 'MISSION', rarity: 'EPIC', icon: '🏆', hidden: false, version: 1, target: 100,
    reward: { xp: 30, fragments: 150, badge: 'badge_mestre_missoes', frame: null, title: 'Mestre' },
  },

  // ── STREAK ──
  STREAK_3: {
    id: 'STREAK_3', title: 'Hábito', description: 'Entre 3 dias seguidos',
    category: 'STREAK', rarity: 'COMMON', icon: '🔥', hidden: false, version: 1, target: 3,
    reward: { xp: 30, fragments: 0, badge: null, frame: null, title: null },
  },
  STREAK_7: {
    id: 'STREAK_7', title: 'Sequência Semanal', description: 'Entre 7 dias seguidos',
    category: 'STREAK', rarity: 'RARE', icon: '⚡', hidden: false, version: 1, target: 7,
    reward: { xp: 30, fragments: 40, badge: 'badge_streak_7', frame: null, title: null },
  },
  STREAK_30: {
    id: 'STREAK_30', title: 'Devoto', description: 'Entre 30 dias seguidos',
    category: 'STREAK', rarity: 'LEGENDARY', icon: '👑', hidden: false, version: 1, target: 30,
    reward: { xp: 30, fragments: 200, badge: 'badge_devoto', frame: 'frame_devoto', title: 'Devoto' },
  },

  // ── TREE ──
  TREE_STAGE_1: {
    id: 'TREE_STAGE_1', title: 'Em Crescimento', description: 'Árvore de Sintonia: estágio Crescimento',
    category: 'TREE', rarity: 'COMMON', icon: '🌿', hidden: false, version: 1, target: 1,
    reward: { xp: 30, fragments: 0, badge: null, frame: null, title: null },
  },
  TREE_STAGE_4: {
    id: 'TREE_STAGE_4', title: 'Galáxia Viva', description: 'Árvore de Sintonia: estágio Galáxia',
    category: 'TREE', rarity: 'MYTHIC', icon: '💜', hidden: false, version: 1, target: 1,
    reward: { xp: 30, fragments: 300, badge: 'badge_galaxia_viva', frame: 'frame_galaxia', title: 'Guardião da Sintonia' },
  },

  // ── VAULT ──
  VAULT_FIRST: {
    id: 'VAULT_FIRST', title: 'Primeiro Saque', description: 'Faça seu primeiro saque do Cofre',
    category: 'VAULT', rarity: 'COMMON', icon: '🗝️', hidden: false, version: 1, target: 1,
    reward: { xp: 30, fragments: 0, badge: null, frame: null, title: null },
  },
  VAULT_10: {
    id: 'VAULT_10', title: 'Guardião do Cofre', description: 'Faça 10 saques do Cofre',
    category: 'VAULT', rarity: 'RARE', icon: '💰', hidden: false, version: 1, target: 10,
    reward: { xp: 30, fragments: 80, badge: 'badge_guardiao_cofre', frame: null, title: null },
  },

  // ── CHAT ──
  CHAT_FIRST: {
    id: 'CHAT_FIRST', title: 'Primeira Conversa', description: 'Inicie sua primeira conversa real',
    category: 'CHAT', rarity: 'COMMON', icon: '💬', hidden: false, version: 1, target: 1,
    reward: { xp: 30, fragments: 0, badge: null, frame: null, title: null },
  },
  CHAT_10: {
    id: 'CHAT_10', title: 'Comunicador', description: 'Inicie 10 conversas reais',
    category: 'CHAT', rarity: 'RARE', icon: '🗣️', hidden: false, version: 1, target: 10,
    reward: { xp: 30, fragments: 50, badge: 'badge_comunicador', frame: null, title: null },
  },

  // ── FOUNDER (REGRA 18) ──
  FOUNDER_EARLY: {
    id: 'FOUNDER_EARLY', title: 'Fundador', description: 'Entrou no Lumina durante o lançamento',
    category: 'FOUNDER', rarity: 'MYTHIC', icon: '🌟', hidden: false, version: 1, target: 1,
    reward: { xp: 30, fragments: 0, badge: 'badge_fundador', frame: 'frame_fundador', title: 'Fundador' },
  },
  CREATOR_ZERO: {
    id: 'CREATOR_ZERO', title: 'Creator Zero', description: 'Primeiro criador de conteúdo do Lumina',
    category: 'FOUNDER', rarity: 'MYTHIC', icon: '🎨', hidden: true, version: 1, target: 1,
    reward: { xp: 30, fragments: 0, badge: 'badge_creator_zero', frame: null, title: 'Creator Zero' },
  },

  // ── PREMIUM (REGRA 19) ──
  PREMIUM_30: {
    id: 'PREMIUM_30', title: 'Galáxia Plus 30 dias', description: 'Assine Galáxia Plus por 30 dias',
    category: 'PREMIUM', rarity: 'EPIC', icon: '💜', hidden: false, version: 1, target: 30,
    reward: { xp: 30, fragments: 0, badge: 'badge_galaxia_plus', frame: null, title: null },
  },
  FIRST_PURCHASE: {
    id: 'FIRST_PURCHASE', title: 'Apoiador', description: 'Realize sua primeira compra de cristais',
    category: 'PREMIUM', rarity: 'RARE', icon: '💎', hidden: false, version: 1, target: 1,
    reward: { xp: 30, fragments: 0, badge: 'badge_apoiador', frame: null, title: 'Apoiador' },
  },
};

// Conquistas verificadas por categoria de ação (REGRA 13)
export const ACHIEVEMENTS_BY_ACTION: Record<string, string[]> = {
  CREATE_SINTONIA:   ['FIRST_SINTONIA', 'SINTONIA_10', 'SINTONIA_50', 'SINTONIA_PERFEITA'],
  VISIT_PROFILE:     ['EXPLORER_10', 'EXPLORER_50', 'EXPLORER_100'],
  COMPLETE_MISSION:  ['MISSION_7', 'MISSION_30', 'MISSION_100'],
  STREAK_UPDATE:     ['STREAK_3', 'STREAK_7', 'STREAK_30'],
  TREE_EVOLUTION:    ['TREE_STAGE_1', 'TREE_STAGE_4'],
  VAULT_WITHDRAW:    ['VAULT_FIRST', 'VAULT_10'],
  START_CONVO:       ['CHAT_FIRST', 'CHAT_10'],
  FOUNDER_JOIN:      ['FOUNDER_EARLY'],
  CREATOR_APPROVED:  ['CREATOR_ZERO'],
  FIRST_PURCHASE:    ['FIRST_PURCHASE'],
  PREMIUM_DAY:       ['PREMIUM_30'],
};
// ============================================
// LUMINA — COLLECTIONS CATALOG v5.1
// functions/src/config/collectionsCatalog.ts
//
// REGRA 2:  3 níveis — Bronze/Prata/Ouro
// REGRA 11: collectionId, title, category, achievementIds, reward, completed
// REGRA 16: Badge exclusivo por coleção
// REGRA 18: Coleção Fundador
// ============================================

export type CollectionTier = 'BRONZE' | 'SILVER' | 'GOLD';

export interface CollectionDef {
  id:             string;
  title:          string;
  description:    string;
  category:       string;
  tier:           CollectionTier;
  icon:           string;
  achievementIds: string[];       // REGRA 11
  reward: {
    fragments:    number;
    badge:        string | null;  // REGRA 16
    title:        string | null;
  };
}

export const COLLECTIONS_CATALOG: Record<string, CollectionDef> = {

  // ── Social ──
  SOCIAL_BRONZE: {
    id: 'SOCIAL_BRONZE', title: 'Coleção Social Bronze', description: 'Dê os primeiros passos sociais',
    category: 'SOCIAL', tier: 'BRONZE', icon: '🥉',
    achievementIds: ['FIRST_SINTONIA', 'CHAT_FIRST'],
    // Coleções dão FRAGMENTOS e TÍTULO — os badges saíram por
    // decisão de produto: eles já são a recompensa das
    // conquistas individuais, e repetir aqui esvaziava as duas
    // coisas. Os valores caíram pela metade junto.
    reward: { fragments: 25,  badge: null,                   title: null },
  },
  SOCIAL_SILVER: {
    id: 'SOCIAL_SILVER', title: 'Coleção Social Prata', description: 'Construa conexões reais',
    category: 'SOCIAL', tier: 'SILVER', icon: '🥈',
    achievementIds: ['SINTONIA_10', 'CHAT_10'],
    reward: { fragments: 50, badge: null, title: null },
  },
  SOCIAL_GOLD: {
    id: 'SOCIAL_GOLD', title: 'Coleção Social Ouro', description: 'Mestre das conexões',
    category: 'SOCIAL', tier: 'GOLD', icon: '🥇',
    // SINTONIA_PERFEITA saiu daqui: ela exige 95%+ de
    // compatibilidade, e a sintonia é calculada no CLIENTE —
    // o servidor não sabe esse número, então NINGUÉM dispara
    // essa conquista. Com ela na lista, a coleção era
    // impossível, e o marco de prestígio "3 Coleções Ouro"
    // ficava fora de alcance junto.
    //
    // CHAT_10 no lugar: também é social, também é difícil, e
    // funciona hoje. A SINTONIA_PERFEITA continua no catálogo
    // como conquista oculta, para quando houver cálculo de
    // compatibilidade no servidor.
    achievementIds: ['SINTONIA_50', 'CHAT_10'],
    reward: { fragments: 125, badge: null, title: 'Alma Social' },
  },

  // ── Explorer ──
  EXPLORER_BRONZE: {
    id: 'EXPLORER_BRONZE', title: 'Coleção Explorador Bronze', description: 'Comece a explorar',
    category: 'EXPLORER', tier: 'BRONZE', icon: '🥉',
    achievementIds: ['EXPLORER_10'],
    reward: { fragments: 25,  badge: null,                    title: null },
  },
  EXPLORER_SILVER: {
    id: 'EXPLORER_SILVER', title: 'Coleção Explorador Prata', description: 'Explore o universo Lumina',
    category: 'EXPLORER', tier: 'SILVER', icon: '🥈',
    achievementIds: ['EXPLORER_50'],
    reward: { fragments: 50, badge: null, title: null },
  },
  EXPLORER_GOLD: {
    id: 'EXPLORER_GOLD', title: 'Coleção Explorador Ouro', description: 'Grande explorador cósmico',
    category: 'EXPLORER', tier: 'GOLD', icon: '🥇',
    achievementIds: ['EXPLORER_100'],
    reward: { fragments: 125, badge: null, title: 'Explorador Supremo' },
  },

  // ── Mission ──
  MISSION_BRONZE: {
    id: 'MISSION_BRONZE', title: 'Coleção Missões Bronze', description: 'Complete as primeiras missões',
    category: 'MISSION', tier: 'BRONZE', icon: '🥉',
    achievementIds: ['MISSION_7'],
    reward: { fragments: 25,  badge: null,                    title: null },
  },
  MISSION_SILVER: {
    id: 'MISSION_SILVER', title: 'Coleção Missões Prata', description: 'Missões mensais completas',
    category: 'MISSION', tier: 'SILVER', icon: '🥈',
    achievementIds: ['MISSION_30'],
    reward: { fragments: 50, badge: null, title: null },
  },
  MISSION_GOLD: {
    id: 'MISSION_GOLD', title: 'Coleção Missões Ouro', description: 'Mestre absoluto das missões',
    category: 'MISSION', tier: 'GOLD', icon: '🥇',
    achievementIds: ['MISSION_100'],
    reward: { fragments: 125, badge: null, title: 'Mestre Supremo' },
  },

  // ── Streak ──
  STREAK_BRONZE: {
    id: 'STREAK_BRONZE', title: 'Coleção Sequência Bronze', description: 'Primeiros dias seguidos',
    category: 'STREAK', tier: 'BRONZE', icon: '🥉',
    achievementIds: ['STREAK_3'],
    reward: { fragments: 25,  badge: null,                    title: null },
  },
  STREAK_GOLD: {
    id: 'STREAK_GOLD', title: 'Coleção Sequência Ouro', description: 'Um mês de dedicação',
    category: 'STREAK', tier: 'GOLD', icon: '🥇',
    achievementIds: ['STREAK_7', 'STREAK_30'],
    reward: { fragments: 125, badge: null, title: 'Devoto Supremo' },
  },

  // ── Fundador (REGRA 18) ──
  FOUNDER_COLLECTION: {
    id: 'FOUNDER_COLLECTION', title: 'Coleção Fundador', description: 'Pioneiro do Lumina',
    category: 'FOUNDER', tier: 'GOLD', icon: '🌟',
    achievementIds: ['FOUNDER_EARLY'],
    // Fundador fica só com o título: ela já dava 0 fragmentos, e
    // o badge saiu como nas outras.
    reward: { fragments: 0, badge: null, title: 'Pioneiro' },
  },
};
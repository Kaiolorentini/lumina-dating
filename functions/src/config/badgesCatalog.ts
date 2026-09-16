// ============================================
// LUMINA — CATÁLOGO DE BADGES DA LOJA v2.0
// functions/src/config/badgesCatalog.ts
//
// FASE 8 — badges deixaram de ser emblemas abstratos e passaram
// a ser SINAIS DE INTENÇÃO: quem a pessoa é e o que procura.
//
// O campo `meaning` é o que aparece no card do perfil, ao lado do
// símbolo. Um ícone sozinho não comunica "só de passagem" — o
// texto é parte do produto, não decoração.
//
// REGISTRO: insinuar, nunca declarar. "Prefere o que arde a o que
// dura" diz o mesmo que um rótulo vulgar, com elegância — e é o
// que mantém o app apresentável num perfil público.
//
// LINHA SEPARADA DAS CONQUISTAS. Os 19 badges de
// achievementsCatalog/collectionsCatalog continuam gratuitos,
// permanentes e ganhos jogando. Nenhum id aqui colide com os de lá.
//
// DUAS MOEDAS, DOIS REGIMES:
//   fragmentos → PERMANENTES. São a porta de entrada de quem
//     nunca gastou dinheiro. O badge barato cria o desejo pelo
//     caro em vez de competir com ele: quem nunca teve badge não
//     sente falta, quem tem a Faísca olha para o Quasar.
//   cristais   → aluguel de 30 dias, recompra soma os dias.
// ============================================

export type BadgeRarity   = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type BadgeCurrency = 'FRAGMENTS' | 'CRYSTALS';

export interface BadgeDef {
  id:          string;
  costKey:     string;        // '' para os de fragmentos
  title:       string;
  /** O que este badge diz sobre a pessoa. Aparece no card. */
  meaning:     string;
  rarity:      BadgeRarity;
  currency:    BadgeCurrency;
  price:       number;        // fragmentos OU cristais
  /** 0 = permanente. Fragmentos são sempre 0. */
  rentalDays:  number;
  shape:       'spark' | 'orbit' | 'constellation' | 'tide'
             | 'meteor' | 'pulsar' | 'compass' | 'lighthouse'
             | 'wanderer' | 'greenhouse'
             | 'ice_ring' | 'stardust' | 'solar_crown'
             | 'crimson_nebula' | 'eclipse' | 'prism'
             | 'quasar' | 'singularity' | 'genesis' | 'milky_way';
  coreColor:   string;
  accentColor: string;
  glowColor:   string;
  motion:      'none' | 'breathe' | 'rotate' | 'orbit_particles';
}

export const BADGES_CATALOG: Record<string, BadgeDef> = {

  // ── FRAGMENTOS — permanentes, porta de entrada ──
  badge_faisca: {
    id: 'badge_faisca', costKey: '', title: 'Faísca',
    meaning: 'Começando agora, sem pressa de rótulo',
    rarity: 'COMMON', currency: 'FRAGMENTS', price: 150, rentalDays: 0,
    shape: 'spark',
    coreColor: '#B57BEE', accentColor: '#E0CCFF', glowColor: 'rgba(181,123,238,0.45)',
    motion: 'none',
  },
  badge_orbita: {
    id: 'badge_orbita', costKey: '', title: 'Órbita',
    meaning: 'Gosta de companhia constante',
    rarity: 'COMMON', currency: 'FRAGMENTS', price: 250, rentalDays: 0,
    shape: 'orbit',
    coreColor: '#56CCF2', accentColor: '#CFF0FF', glowColor: 'rgba(86,204,242,0.45)',
    motion: 'none',
  },
  badge_constelacao: {
    id: 'badge_constelacao', costKey: '', title: 'Constelação',
    meaning: 'Coleciona boas conversas',
    rarity: 'COMMON', currency: 'FRAGMENTS', price: 400, rentalDays: 0,
    shape: 'constellation',
    coreColor: '#FFFFFF', accentColor: '#9BB8FF', glowColor: 'rgba(155,184,255,0.45)',
    motion: 'none',
  },
  badge_mare: {
    id: 'badge_mare', costKey: '', title: 'Maré',
    meaning: 'Vai e volta, no próprio ritmo',
    rarity: 'COMMON', currency: 'FRAGMENTS', price: 600, rentalDays: 0,
    shape: 'tide',
    coreColor: '#4A9FD4', accentColor: '#C8E8FF', glowColor: 'rgba(74,159,212,0.45)',
    motion: 'none',
  },

  // ── RARE — 70 cristais, aluguel 30 dias ──
  badge_meteoro: {
    id: 'badge_meteoro', costKey: 'BADGE_METEORO', title: 'Meteoro',
    meaning: 'Intenso e rápido — prefere o que arde ao que dura',
    rarity: 'RARE', currency: 'CRYSTALS', price: 70, rentalDays: 30,
    shape: 'meteor',
    coreColor: '#FFC24A', accentColor: '#FFE9B8', glowColor: 'rgba(255,194,74,0.6)',
    motion: 'breathe',
  },
  badge_pulsar: {
    id: 'badge_pulsar', costKey: 'BADGE_PULSAR', title: 'Pulsar',
    meaning: 'Direto — manda sinal e espera resposta',
    rarity: 'RARE', currency: 'CRYSTALS', price: 70, rentalDays: 30,
    shape: 'pulsar',
    coreColor: '#7BE0FF', accentColor: '#CFF6FF', glowColor: 'rgba(123,224,255,0.6)',
    motion: 'breathe',
  },
  badge_bussola: {
    id: 'badge_bussola', costKey: 'BADGE_BUSSOLA', title: 'Bússola',
    meaning: 'Sabe exatamente o que procura',
    rarity: 'RARE', currency: 'CRYSTALS', price: 70, rentalDays: 30,
    shape: 'compass',
    coreColor: '#D4AF37', accentColor: '#FFF0C0', glowColor: 'rgba(212,175,55,0.6)',
    motion: 'breathe',
  },
  badge_farol: {
    id: 'badge_farol', costKey: 'BADGE_FAROL', title: 'Farol',
    meaning: 'Aqui para quem precisa de porto seguro',
    rarity: 'RARE', currency: 'CRYSTALS', price: 70, rentalDays: 30,
    shape: 'lighthouse',
    coreColor: '#FFE9A8', accentColor: '#FFFFFF', glowColor: 'rgba(255,233,168,0.6)',
    motion: 'breathe',
  },
  badge_andarilho: {
    id: 'badge_andarilho', costKey: 'BADGE_ANDARILHO', title: 'Andarilho',
    meaning: 'Só de passagem, sem promessas',
    rarity: 'RARE', currency: 'CRYSTALS', price: 70, rentalDays: 30,
    shape: 'wanderer',
    coreColor: '#9B8FA8', accentColor: '#E0D8E8', glowColor: 'rgba(155,143,168,0.6)',
    motion: 'breathe',
  },
  badge_estufa: {
    id: 'badge_estufa', costKey: 'BADGE_ESTUFA', title: 'Estufa',
    meaning: 'Amizade primeiro — o resto se vê',
    rarity: 'RARE', currency: 'CRYSTALS', price: 70, rentalDays: 30,
    shape: 'greenhouse',
    coreColor: '#5FD48A', accentColor: '#C8FFDC', glowColor: 'rgba(95,212,138,0.6)',
    motion: 'breathe',
  },

  // ── EPIC — 100 cristais, aluguel 30 dias ──
  badge_anel_gelo: {
    id: 'badge_anel_gelo', costKey: 'BADGE_ANEL_GELO', title: 'Anel de Gelo',
    meaning: 'Difícil de alcançar — quem chegar vai ter merecido',
    rarity: 'EPIC', currency: 'CRYSTALS', price: 100, rentalDays: 30,
    shape: 'ice_ring',
    coreColor: '#A8E6FF', accentColor: '#FFFFFF', glowColor: 'rgba(168,230,255,0.7)',
    motion: 'rotate',
  },
  badge_poeira_estelar: {
    id: 'badge_poeira_estelar', costKey: 'BADGE_POEIRA_ESTELAR', title: 'Poeira Estelar',
    meaning: 'Aberto ao acaso — deixa acontecer',
    rarity: 'EPIC', currency: 'CRYSTALS', price: 100, rentalDays: 30,
    shape: 'stardust',
    coreColor: '#C89BFF', accentColor: '#F0E0FF', glowColor: 'rgba(200,155,255,0.7)',
    motion: 'rotate',
  },
  badge_coroa_solar: {
    id: 'badge_coroa_solar', costKey: 'BADGE_COROA_SOLAR', title: 'Coroa Solar',
    meaning: 'Reservado por fora, incandescente por dentro',
    rarity: 'EPIC', currency: 'CRYSTALS', price: 100, rentalDays: 30,
    shape: 'solar_crown',
    coreColor: '#1A1A2E', accentColor: '#FFB347', glowColor: 'rgba(255,179,71,0.7)',
    motion: 'rotate',
  },
  badge_nebulosa_carmim: {
    id: 'badge_nebulosa_carmim', costKey: 'BADGE_NEBULOSA_CARMIM', title: 'Nebulosa Carmim',
    meaning: 'Romântico sem medo de ser — quer história, não passagem',
    rarity: 'EPIC', currency: 'CRYSTALS', price: 100, rentalDays: 30,
    shape: 'crimson_nebula',
    coreColor: '#FF6B8A', accentColor: '#FFD0DC', glowColor: 'rgba(255,107,138,0.7)',
    motion: 'rotate',
  },
  badge_eclipse: {
    id: 'badge_eclipse', costKey: 'BADGE_ECLIPSE', title: 'Eclipse',
    meaning: 'Discreto — prefere o que ninguém vê',
    rarity: 'EPIC', currency: 'CRYSTALS', price: 100, rentalDays: 30,
    shape: 'eclipse',
    coreColor: '#14141F', accentColor: '#E8D8A8', glowColor: 'rgba(232,216,168,0.7)',
    motion: 'rotate',
  },
  badge_cristal: {
    id: 'badge_cristal', costKey: 'BADGE_CRISTAL', title: 'Cristal',
    meaning: 'Transparente demais — fala o que pensa',
    rarity: 'EPIC', currency: 'CRYSTALS', price: 100, rentalDays: 30,
    shape: 'prism',
    coreColor: '#D8F0FF', accentColor: '#8FD4FF', glowColor: 'rgba(216,240,255,0.7)',
    motion: 'rotate',
  },

  // ── LEGENDARY — 150 cristais, aluguel 30 dias ──
  badge_quasar: {
    id: 'badge_quasar', costKey: 'BADGE_QUASAR', title: 'Quasar',
    meaning: 'Impossível de ignorar — sabe o que tem e o que quer',
    rarity: 'LEGENDARY', currency: 'CRYSTALS', price: 150, rentalDays: 30,
    shape: 'quasar',
    coreColor: '#FFFFFF', accentColor: '#7B2FBE', glowColor: 'rgba(123,47,190,0.85)',
    motion: 'orbit_particles',
  },
  badge_singularidade: {
    id: 'badge_singularidade', costKey: 'BADGE_SINGULARIDADE', title: 'Singularidade',
    meaning: 'Lobo solitário — mas quem entrar, entra sem volta',
    rarity: 'LEGENDARY', currency: 'CRYSTALS', price: 150, rentalDays: 30,
    shape: 'singularity',
    coreColor: '#0A0A14', accentColor: '#FFD700', glowColor: 'rgba(255,215,0,0.85)',
    motion: 'orbit_particles',
  },
  badge_genese: {
    id: 'badge_genese', costKey: 'BADGE_GENESE', title: 'Gênese',
    meaning: 'Pronto para recomeçar — página em branco',
    rarity: 'LEGENDARY', currency: 'CRYSTALS', price: 150, rentalDays: 30,
    shape: 'genesis',
    coreColor: '#FFFFFF', accentColor: '#FFE9B8', glowColor: 'rgba(255,255,255,0.9)',
    motion: 'orbit_particles',
  },
  badge_via_lactea: {
    id: 'badge_via_lactea', costKey: 'BADGE_VIA_LACTEA', title: 'Via Láctea',
    meaning: 'Vasto demais para um só — e honesto sobre isso',
    rarity: 'LEGENDARY', currency: 'CRYSTALS', price: 150, rentalDays: 30,
    shape: 'milky_way',
    coreColor: '#FFF4D0', accentColor: '#B57BEE', glowColor: 'rgba(255,244,208,0.85)',
    motion: 'orbit_particles',
  },
};

// COSTS key → badge id. Só os pagos em cristais entram aqui: os
// de fragmentos não passam pelo spendCoins.
export const COST_KEY_TO_BADGE: Record<string, string> = Object.values(BADGES_CATALOG)
  .filter(b => b.costKey !== '')
  .reduce((acc, b) => { acc[b.costKey] = b.id; return acc; }, {} as Record<string, string>);

export const FRAGMENT_BADGES: BadgeDef[] =
  Object.values(BADGES_CATALOG).filter(b => b.currency === 'FRAGMENTS');

export const CRYSTAL_BADGES: BadgeDef[] =
  Object.values(BADGES_CATALOG).filter(b => b.currency === 'CRYSTALS');
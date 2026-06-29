// ============================================
// LUMINA — CATÁLOGO CENTRAL DA ECONOMIA v5.1
// functions/src/config/economy.ts
//
// REGRA: O cliente NUNCA informa preços.
// O backend sempre consulta este arquivo.
// ============================================

// ------------------------------------------
// HIERARQUIA DE MOEDAS
// ------------------------------------------
// Fragmento de Sintonia  → moeda menor (abundante, não comprável)
// Cristal de Sintonia    → moeda principal (escassa)
// Núcleo de Sintonia     → reservado para expansão futura
//
// Conversão: 100 fragmentos = 1 cristal gratuito

// ------------------------------------------
// CUSTOS — Saídas de Cristais
// REGRA: cliente envia feature, backend decide preço
// ------------------------------------------
export const COSTS = {
  // Revelações — acessíveis com Gratuitos
  REVEAL_VISITORS:         50,  // Ver quem visitou
  REVEAL_MYSTERY_MATCH:    30,  // Sintonia Misteriosa
  REVEAL_PENSOU_EM_VOCE:   20,  // Alguém pensou em você
  REVEAL_QUASE_SINTONIA:   25,  // Quase Sintonia

  // Revelações — PREMIUM ONLY (nunca com Gratuitos)
  REVEAL_SINTONIA_PERDIDA: 35,  // Sintonia Perdida — premium only

  // Destaques — acessíveis com Gratuitos
  IMPULSO_PERFIL:          80,  // 30 minutos
  DESTAQUE_REGIONAL:      150,  // 4 horas
  MEGA_DESTAQUE:          500,  // 24 horas
  SEGUNDA_CHANCE:          15,  // rever perfil descartado

  // Destaques — PREMIUM ONLY
  TURBO_SINTONIA:         120,  // 30 min — premium only

  // Perfil
  PERFIL_GALAXIA:         200,  // borda/mês

  // Energia
  RECARREGAR_ENERGIA:       5,  // +20 energia social

  // Progressão — PREMIUM ONLY
  FERTILIZANTE_SINTONIA:   80,  // +50% XP árvore por 24h — premium only

  // Mercado Cósmico — Comum (Gratuitos)
  MOLDURA_NEBULOSA:        50,
  MOLDURA_ECLIPSE:         50,
  MOLDURA_SUPERNOVA:       50,

  // Mercado Cósmico — PREMIUM ONLY (Lendário+)
  EFEITO_AURORA:           80,
  TEMA_GALAXIA:           120,
  COR_NOME_ESPECIAL:       60,
  EFEITO_ENTRADA:         150,
} as const;

// ------------------------------------------
// RECOMPENSAS — Entradas Gratuitas
// Calibradas para 20–25 cristais/dia (casual)
// Máximo 30–40 cristais/dia (muito ativo)
// ------------------------------------------
export const REWARDS = {
  // Login diário (antes do multiplicador)
  LOGIN_BASE:              5,
  LOGIN_MAX:              10,

  // Faísca do Destino — probabilidades calibradas
  // Média real: ~4.7 cristais/dia
  FAISCA: [
    { value: 2,  probability: 0.60 },  // 60% → evento comum
    { value: 5,  probability: 0.25 },  // 25% → evento frequente
    { value: 10, probability: 0.10 },  // 10% → evento raro
    { value: 20, probability: 0.04 },  //  4% → evento muito raro
    { value: 50, probability: 0.01 },  //  1% → evento memorável
  ],

  // Missões especiais (raras — 1-2/semana)
  MISSAO_ESPECIAL_MIN:     3,
  MISSAO_ESPECIAL_MAX:     5,

  // Conquistas raras
  CONQUISTA_MIN:          10,
  CONQUISTA_MAX:          20,

  // Prestígio — simbólico, não inflacionário
  PRESTIGIO_BONUS:        50,

  // Bônus de primeira compra (1x por conta — dobra o pacote Iniciante)
  FIRST_PURCHASE_BONUS:  100,

  // Galáxia Plus mensal
  GALAXIA_PLUS_MONTHLY:  500,  // mix gratuito + premium
} as const;

// ------------------------------------------
// FRAGMENTOS DE SINTONIA
// Moeda secundária abundante — não comprável
// ------------------------------------------
export const FRAGMENTS = {
  // Ganho passivo (Cofre de Sintonia)
  PER_LIKE_RECEIVED:        1,
  PER_VISIT_RECEIVED:       1,
  PER_SINTONIA:             3,

  // Missões comuns pagam fragmentos (não cristais)
  MISSAO_COMUM_MIN:        10,
  MISSAO_COMUM_MAX:        30,

  // Limite diário de fragmentos vindos de visitas
  VAULT_VISITS_DAILY_MAX:  20,

  // Conversão: cooldown 24h, máx 5 cristais por conversão
  FRAGMENTS_PER_CRYSTAL:  100,
  MAX_CRYSTALS_PER_CONVERSION: 5,
  CONVERSION_COOLDOWN_HOURS:   24,

  // Expiração parcial — anti-acúmulo passivo
  EXPIRY_DAYS_WITHOUT_CONVERT: 7,   // dias sem converter
  EXPIRY_PERCENTAGE:           0.10, // 10% expiram
} as const;

// ------------------------------------------
// LIMITES DIÁRIOS — Teto anti-inflação
// ------------------------------------------
export const DAILY_LIMITS = {
  // Teto de cristais gratuitos por dia (hard limit server-side)
  CRYSTALS_GRATUITOS_MAX:          40,

  // Teto mensal de cristais gratuitos
  CRYSTALS_GRATUITOS_MONTHLY_MAX:  800,

  // XP de curtidas (anti-farm de contas duplas)
  XP_FROM_LIKES_MAX:               100,

  // Fragmentos do Cofre vindos de visitas
  VAULT_FRAGMENTS_FROM_VISITS:      20,

  // Sintonias Perdidas por dia (máx 3, 1 por visitante único)
  SINTONIA_PERDIDA_MAX:              3,

  // Oferta Relâmpago (1x por 24h)
  FLASH_OFFER_COOLDOWN_HOURS:       24,

  // Carta do Destino
  DESTINY_CARDS_FREE:                1,  // gratuito
  DESTINY_CARDS_GALAXIA_PLUS:       10,  // Galáxia Plus (não ilimitado)
} as const;

// ------------------------------------------
// MULTIPLICADORES DE SEQUÊNCIA
// ------------------------------------------
export const STREAK_MULTIPLIERS = [
  { minDays: 1,  multiplier: 1.0 },
  { minDays: 3,  multiplier: 1.5 },
  { minDays: 7,  multiplier: 2.0 },
  { minDays: 15, multiplier: 3.0 },
  { minDays: 30, multiplier: 5.0 },
] as const;

// ------------------------------------------
// XP
// ------------------------------------------
export const XP_REWARDS = {
  VISIT_PROFILE:       1,   // 1x por perfil por dia (anti-farm)
  GIVE_LIKE:           3,   // 1x por perfil por dia
  RECEIVE_LIKE:        5,   // apenas de UIDs únicos, máx 100 XP/dia
  START_CONVERSATION:  10,  // apenas após resposta do outro usuário
  CREATE_SINTONIA:     20,  // apenas quando ambos curtiram
  COMPLETE_MISSION:    15,
  UNLOCK_ACHIEVEMENT:  30,
} as const;

export const XP_LEVELS = [
  { level: 1,  xpRequired: 100,   tier: 'comum'    },
  { level: 2,  xpRequired: 250,   tier: 'comum'    },
  { level: 3,  xpRequired: 500,   tier: 'raro'     },
  { level: 4,  xpRequired: 900,   tier: 'raro'     },
  { level: 5,  xpRequired: 1500,  tier: 'epico'    },
  { level: 10, xpRequired: 5000,  tier: 'lendario' },
  { level: 20, xpRequired: 15000, tier: 'lendario' },
  { level: 50, xpRequired: 60000, tier: 'galaxia'  },
] as const;

// ------------------------------------------
// PACOTES DE COMPRA
// ------------------------------------------
export const COIN_PACKAGES = {
  starter: {
    id:                 'starter',
    label:              'Iniciante',
    coinsPremium:       100,
    bonus:              0,
    firstPurchaseBonus: 100,  // dobra na primeira compra (1x por conta)
    priceValue:         4.99,
    packAsset:          'pack-iniciante',  // assets/premium/pack-iniciante.png
  },
  popular: {
    id:                 'popular',
    label:              'Popular',
    coinsPremium:       500,
    bonus:              100,
    firstPurchaseBonus: 0,
    priceValue:         19.99,
    highlighted:        true,
    packAsset:          'pack-popular',   // assets/premium/pack-popular.png
  },
  supremo: {
    id:                 'supremo',
    label:              'Supremo',
    coinsPremium:       1000,
    bonus:              500,
    firstPurchaseBonus: 0,
    priceValue:         39.99,
    packAsset:          'pack-supremo',   // assets/premium/pack-supremo.png
  },
  galaxia: {
    id:                 'galaxia',
    label:              'Galáxia',
    coinsPremium:       4000,
    bonus:              2000,
    firstPurchaseBonus: 0,
    priceValue:         99.99,
    packAsset:          'pack-galaxia',   // assets/premium/pack-galaxia.png
  },
} as const;

export type CoinPackageId = keyof typeof COIN_PACKAGES;

// ------------------------------------------
// FEATURES QUE EXIGEM CRISTAIS PREMIUM
// Nunca acessíveis com Cristais Gratuitos
// ------------------------------------------
export const PREMIUM_ONLY_FEATURES = [
  'REVEAL_SINTONIA_PERDIDA',   // Gatilho emocional mais forte
  'TURBO_SINTONIA',            // Aceleração de visibilidade
  'FERTILIZANTE_SINTONIA',     // Aceleração da Árvore
  'EFEITO_AURORA',             // Mercado Cósmico Lendário
  'TEMA_GALAXIA',
  'COR_NOME_ESPECIAL',
  'EFEITO_ENTRADA',
] as const;

export type PremiumOnlyFeature = typeof PREMIUM_ONLY_FEATURES[number];

// ------------------------------------------
// LOJA ROTATIVA — Mercado Cósmico
// Itens mudam semanalmente (nunca repetem)
// ------------------------------------------
export const COSMIC_MARKET_ROTATION = [
  { weekOffset: 0, item: 'MOLDURA_NEBULOSA',  tier: 'epico'    },
  { weekOffset: 1, item: 'MOLDURA_ECLIPSE',   tier: 'epico'    },
  { weekOffset: 2, item: 'MOLDURA_SUPERNOVA', tier: 'lendario' },
  { weekOffset: 3, item: 'EFEITO_AURORA',     tier: 'lendario' },
  { weekOffset: 4, item: 'TEMA_GALAXIA',      tier: 'galaxia'  },
] as const;

// ------------------------------------------
// GALÁXIA PLUS — Assinatura
// ------------------------------------------
export const GALAXIA_PLUS = {
  MONTHLY_PRICE:           19.90,
  MONTHLY_CRYSTALS:         500,   // mix gratuito + premium
  DESTINY_CARDS_PER_DAY:    10,    // vs 1 gratuito (não ilimitado)
  TURBO_SINTONIAS_PER_WEEK:  1,    // grátis (valor: 120 cristais)
  REVEAL_DISCOUNT:           0.10, // 10% desconto em revelações com Gratuitos
  VAULT_INSTANT_WITHDRAW:    true, // saque imediato do Cofre
  SINTONIA_PERDIDA_FREE:     true, // Sintonia Perdida sem custo extra
  QUASE_SINTONIA_FREE:       true, // Quase Sintonia sem custo extra
  CARD_ASSET:               'galaxia-plus-card', // assets/premium/galaxia-plus-card.png
} as const;

// ------------------------------------------
// VISUAL — Diferenciação Cristal Gratuito vs Premium
// Usado pelos componentes para aplicar estilo correto
// ------------------------------------------
export const CRYSTAL_VISUAL = {
  gratuito: {
    coreColor:    '#7B2FBE',  // Roxo Galáxia
    edgeColor:    '#B57BEE',  // Lilás Nebulosa
    glowColor:    'rgba(123, 47, 190, 0.4)',
    hasParticles: false,
    hasHalo:      false,
    brightness:   'medium',
    asset:        'crystal-sintonia-gratuito',
  },
  premium: {
    coreColor:    '#FFD700',  // Núcleo Dourado Cósmico
    edgeColor:    '#7B2FBE',  // Bordas Roxo Galáxia
    glowColor:    'rgba(255, 215, 0, 0.5)',
    hasParticles: true,       // Partículas douradas
    hasHalo:      true,       // Halo externo
    brightness:   'high',
    asset:        'crystal-sintonia-premium',
  },
} as const;
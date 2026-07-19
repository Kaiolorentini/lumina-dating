// ============================================
// LUMINA — THEME (FONTE ÚNICA)
// src/theme/index.ts
//
// Único arquivo de tokens de design.
// NUNCA usar valores hardcoded nas telas.
// theme/tokens.ts apenas re-exporta daqui.
// ============================================

// ============ COLORS ============

/** Paleta principal (lowercase — legado + novo) */
export const colors = {
  background: '#0D0D0F',
  surface: '#17171B',
  card: '#1F1F25',

  gold: '#D4AF37',
  goldLight: '#F0C85A',
  goldDark: '#A88B20',
  accent: '#8A6CFF',

  success: '#2ECC71',
  warning: '#F39C12',
  error: '#E74C3C',

  white: '#FFFFFF',
  textSecondary: '#BDBDBD',

  gray: '#888888',
  grayLight: '#CCCCCC',
  grayDark: '#444444',
  divider: '#2E2E38',

  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',

  // Audit Q3 2026 — cores recorrentes promovidas a token
  goldLegacy: '#FFD700',
  secondaryLegacy: '#B57BEE',
  cardLegacy: '#1A0A2E',
  primaryLegacy: '#7B2FBE',
  successLegacy: '#A8E063',
  info: '#56CCF2',
  errorLegacy: '#FF6B6B',
};

/** Paleta uppercase (backward-compat com tokens.ts antigo + novos) */
export const COLORS = {
  // Background / Surface
  background: '#0D0D0F',
  surface: '#FFFFFF',       // tokens.ts usava '#F5F0FF' como cor de TEXTO
  card: '#1F1F25',           // era '#1A0A2E'
  cardLight: '#2E2E38',      // era '#2D1B4E'
  border: '#2E2E38',         // era '#3D2B5E'
  borderLight: 'rgba(138, 108, 255, 0.3)', // era rgba(181,123,238,0.3)

  // Brand
  primary: '#D4AF37',       // era '#7B2FBE' (roxo → gold)
  secondary: '#8A6CFF',     // era '#B57BEE' (lilás → accent)
  premium: '#D4AF37',       // era '#FFD700'
  accent: '#8A6CFF',        // novo

  // Feedback
  success: '#2ECC71',       // era '#00E676'
  warning: '#F39C12',       // era '#FFB300'
  error: '#E74C3C',         // era '#FF1744'

  // Text
  textPrimary: '#FFFFFF',   // era '#F5F0FF'
  textSecondary: '#BDBDBD', // era '#B57BEE'
  textMuted: 'rgba(255, 255, 255, 0.5)',  // era rgba(245,240,255,0.5)
  textDark: '#0D0D0F',      // era '#0D0D1A'

  // Overlay
  overlay: 'rgba(13, 13, 15, 0.8)',
  overlayLight: 'rgba(13, 13, 15, 0.4)',

  // Aliases legado
  white: '#FFFFFF',
  gold: '#D4AF37',

  // Audit Q3 2026 — cores recorrentes promovidas a token
  goldLegacy: '#FFD700',
  secondaryLegacy: '#B57BEE',
  cardLegacy: '#1A0A2E',
  primaryLegacy: '#7B2FBE',
  successLegacy: '#A8E063',
  info: '#56CCF2',
  errorLegacy: '#FF6B6B',
} as const;

// ============ TIER COLORS & GLOW ============

export const TIER_COLORS = {
  comum: '#9E9E9E',
  raro: '#C0C0C0',
  epico: '#8A6CFF',
  lendario: '#D4AF37',
  galaxia: '#6C4FD8',
} as const;

export const TIER_GLOW = {
  comum: 'transparent',
  raro: 'rgba(192, 192, 192, 0.3)',
  epico: 'rgba(138, 108, 255, 0.4)',
  lendario: 'rgba(212, 175, 55, 0.4)',
  galaxia: 'rgba(108, 79, 216, 0.6)',
} as const;

// ============ PRESTIGE COLORS ============

export const PRESTIGE_STAGES = [
  { stage: 0, name: 'Desperto', icon: '✨', pts: '0', color: '#C0C0C0' },
  { stage: 1, name: 'Guardião', icon: '🌿', pts: '300', color: '#A8E063' },
  { stage: 2, name: 'Mentor', icon: '🌸', pts: '800', color: '#FF9EBC' },
  { stage: 3, name: 'Constelação', icon: '🌌', pts: '1800', color: '#FFD700' },
  { stage: 4, name: 'Lenda da Sintonia', icon: '💜', pts: '4000', color: '#B57BEE' },
] as const;

export const PRESTIGE_COLORS = {
  desperado: '#C0C0C0',
  guardiao: '#A8E063',
  mentor: '#FF9EBC',
  constelacao: '#FFD700',
  lenda: '#B57BEE',
} as const;

// ============ RANK COLORS ============

export const RANK_COLORS = {
  galaxia: '#B57BEE',
  constelacao: '#FFD700',
  ouro: '#FFA500',
  prata: '#C0C0C0',
  bronze: '#CD7F32',
} as const;

export const RANK_GRADIENTS = {
  gold: ['#FFD700', '#F0C85A'] as string[],
  silver: ['#C0C0C0', '#E0E0E0'] as string[],
  bronze: ['#CD7F32', '#D4A574'] as string[],
} as const;

// ============ RARITY COLORS ============

export const RARITY_COLORS = {
  common: '#AAAAAA',
  rare: '#56CCF2',
  epic: '#B57BEE',
  legendary: '#FFD700',
  mythic: '#FF6B9D',
} as const;

export const RARITY_GLOW = {
  common: 'transparent',
  rare: 'rgba(86, 204, 242, 0.3)',
  epic: 'rgba(181, 123, 238, 0.4)',
  legendary: 'rgba(255, 215, 0, 0.4)',
  mythic: 'rgba(255, 107, 157, 0.5)',
} as const;

// ============ SINTONIA COLORS ============

export const SINTONIA_COLORS = {
  perfect: '#FFD700',
  high: '#B57BEE',
  good: '#56CCF2',
  moderate: '#A8E063',
} as const;

export const SINTONIA_LABELS = {
  perfect: '✦ Sintonia Perfeita',
  high: '🔥 Alta Sintonia',
  good: '⚡ Boa Sintonia',
  moderate: '💫 Sintonia Moderada',
} as const;

// ============ GRADIENTS ============

export const GRADIENTS = {
  primary: ['#D4AF37', '#F0C85A'] as string[],
  premium: ['#D4AF37', '#8A6CFF'] as string[],
  accent: ['#8A6CFF', '#6C4FD8'] as string[],
  card: ['#1F1F25', '#17171B'] as string[],
  success: ['#2ECC71', '#27AE60'] as string[],
  warning: ['#F39C12', '#E67E22'] as string[],
  error: ['#E74C3C', '#C0392B'] as string[],
  galaxia: ['#0D0D0F', '#1F1F25', '#8A6CFF'] as string[],

  // Gamification / HomeScreen
  faisca: ['#1A0A2E', '#2D1B4E'] as string[],
  treeStages: {
    0: ['#0A1A0A', '#1B2E1B'] as string[],
    1: ['#0A1A0A', '#1B3B1B'] as string[],
    2: ['#1A0A2E', '#2D1B4E'] as string[],
    3: ['#1A1A0A', '#2E2D1B'] as string[],
    4: ['#1A0A2E', '#4E1B7E'] as string[],
  },
  faiscaTier: {
    rare: ['#0A1A2E', '#1B3D4E'] as string[],
    epic: ['#2A0A4E', '#4E1B7E'] as string[],
    legendary: ['#2E1A00', '#4E3200'] as string[],
  },
  vault: ['#1A0A0A', '#2E2E2E'] as string[],
  missions: ['#2D1B4E', '#1A0A2E'] as string[],
  missionCompleted: ['#0A2E0A', '#1B4E1B'] as string[],
  destinyCard: ['#1A0A2E', '#2D1B4E'] as string[],
  visits: ['#1F1F25', '#17171B'] as string[],

  // Prestige stages
  prestige: {
    desperado: ['#0D0D0F', '#1A0A2E'] as string[],
    guardiao: ['#1A0A2E', '#2D1B4E'] as string[],
    mentor: ['#2D1B4E', '#4E1B7E'] as string[],
    constelacao: ['#4E1B7E', '#6C4FD8'] as string[],
    lenda: ['#6C4FD8', '#8A6CFF'] as string[],
  },

  // Rank
  rank: {
    gold: ['#FFD700', '#F0C85A'] as string[],
    silver: ['#C0C0C0', '#E0E0E0'] as string[],
    bronze: ['#CD7F32', '#D4A574'] as string[],
  },

  // Vault states
  vaultStates: {
    empty: ['#0D0D1A', '#1A0A2E'] as string[],
    filling: ['#1A0A2E', '#2D1B4E'] as string[],
    ready: ['#2D1B4E', '#D4AF37'] as string[],
    claimed: ['#D4AF37', '#F0C85A'] as string[],
  },

  // Daily Reward
  dailyReward: {
    success: ['#1A0A2E', '#0D0D1A'] as string[],
  },
} as const;

// ============ TYPOGRAPHY ============

export const fonts = {
  regular: 'System',
  bold: 'System',
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    xxl: 28,
    xxxl: 36,
  },
};

export const FONT_SIZE = {
  // Semântico (novo)
  tiny: 8,
  overline: 10,
  caption: 12,
  body: 14,
  subtitle: 16,
  button: 14,
  title: 20,
  hero: 28,
  display: 36,

  // Numérico (backward-compat tokens.ts)
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
} as const;

export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

// ============ SPACING ============

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const SPACING = {
  ...spacing,

  // Novos valores da escala
  xsm: 12,
  mlg: 20,
  xxlm: 40,
  xxxl: 64,
} as const;

// ============ BORDER RADIUS ============

export const borderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  full: 999,
};

export const BORDER_RADIUS = {
  ...borderRadius,          // sm:8, md:16, lg:24, full:999
  xsm: 12,                  // novo
  mlg: 20,                  // novo

  // Backward-compat tokens.ts
  xs: 4,
  xl: 24,                   // era xl, mesmo valor de lg
  xxl: 32,
} as const;

// ============ SHADOWS ============

// ============ GLASS / BACKDROP ============

/** Tokens para efeito glassmorphism — usado em modais, bottom sheets, overlays */
export const GLASS = {
  /** Intensidade de blur (iOS: blurRadius, Android: precisa de biblioteca) */
  blur: {
    subtle: 8,
    medium: 16,
    heavy: 30,
  },
  /** Cores de overlay para backdrop (sobreposição semi-transparente) */
  overlay: 'rgba(13, 13, 15, 0.6)',
  overlayHeavy: 'rgba(13, 13, 15, 0.8)',
  overlayLight: 'rgba(13, 13, 15, 0.4)',
  /** Tintas para superfície glass — usadas com BlurView ou sobreposição */
  tint: 'rgba(255, 255, 255, 0.05)',
  tintLight: 'rgba(255, 255, 255, 0.03)',
  tintHeavy: 'rgba(255, 255, 255, 0.08)',
  /** Borda sutil para superfícies glass */
  border: 'rgba(255, 255, 255, 0.08)',
  /** Borda mais forte (contraste) */
  borderStrong: 'rgba(255, 255, 255, 0.15)',
} as const;

// ============ SHADOWS / ELEVATION ============

export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  /** Cards e superfícies elevadas sutis */
  level1: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  /** Cards em destaque, modais */
  level2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  /** Modais, bottom sheets, cards hero */
  level3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  /** Dropdowns, tooltips, FAB */
  level4: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  /** Toast, alerts no topo */
  level5: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 24,
  },

  // === Glow / colored shadows ===
  premium: {
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  gold: {
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  accent: {
    shadowColor: '#8A6CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },

  // Backward-compat tokens.ts
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  primary: {
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  galaxia: {
    shadowColor: '#6C4FD8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 16,
  },
} as const;

// ============ ELEVATION — NÍVEIS DE CARD ============

/** Níveis de elevação para cards — substitui o padrão `borderWidth: 1` */
export const ELEVATION = {
  /** Card sem borda nem sombra — conteúdo puro */
  none: {
    borderWidth: 0,
    ...SHADOWS.none,
  },
  /** Card sutil — apenas borda fina, sem sombra */
  flat: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    ...SHADOWS.none,
  },
  /** Card padrão — borda + sombra leve (substitui surface card antigo) */
  low: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    ...SHADOWS.level1,
  },
  /** Card em destaque — sem borda, sombra média (substitui card com `borderColor: #444`) */
  medium: {
    borderWidth: 0,
    ...SHADOWS.level2,
  },
  /** Card hero — sem borda, sombra forte */
  high: {
    borderWidth: 0,
    ...SHADOWS.level3,
  },
  /** Card premium — glow gold */
  premium: {
    borderWidth: 0,
    ...SHADOWS.premium,
  },
  /** Card glow roxo (gamificação) */
  accent: {
    borderWidth: 0,
    ...SHADOWS.accent,
  },
} as const;

// ============ PRESS ANIMATION ============

export const PRESS = {
  /** Fator de escala ao pressionar */
  scale: 0.97,
  scaleHeavy: 0.94,
  /** Opacidade ao pressionar */
  opacity: 0.85,
  /** Spring config para animações de entrada */
  spring: {
    damping: 15,
    stiffness: 200,
    mass: 0.8,
  } as const,
  /** Timing config para fade */
  fade: {
    duration: 200,
  } as const,
} as const;

// ============ ANIMATION ============

export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500,
  xslow: 800,
} as const;

// ============ ICON SIZE ============

export const ICON_SIZE = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
  xxl: 64,
} as const;

// ============ TYPES ============

/** Aplica opacidade a cor hex (6 chars) — safe replacement for `COLORS.gold + '44'` */
export function alpha(hex: string, opacity: number): string {
  const a = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

export type ColorKey = keyof typeof colors;
export type ColorUKey = keyof typeof COLORS;
export type TierKey = keyof typeof TIER_COLORS;
export type GradientKey = keyof typeof GRADIENTS;
export type SpacingKey = keyof typeof spacing;
export type SpacingUKey = keyof typeof SPACING;
export type BorderRadiusKey = keyof typeof borderRadius;
export type BorderRadiusUKey = keyof typeof BORDER_RADIUS;
export type FontSizeKey = keyof typeof fonts.sizes;
export type FontSizeUKey = keyof typeof FONT_SIZE;
export type FontWeightKey = keyof typeof FONT_WEIGHT;
export type ShadowKey = keyof typeof SHADOWS;
export type ElevationKey = keyof typeof ELEVATION;
export type GlassKey = keyof typeof GLASS;
export type AnimationKey = keyof typeof ANIMATION;
export type IconSizeKey = keyof typeof ICON_SIZE;

// ============ LEGACY AGGREGATOR ============

export const theme = {
  colors,
  fonts,
  spacing,
  borderRadius,
};

export default theme;

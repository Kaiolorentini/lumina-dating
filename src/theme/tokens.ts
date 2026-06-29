// ============================================
// LUMINA — DESIGN TOKENS
// src/theme/tokens.ts
//
// Fonte única de verdade para cores, espaçamentos,
// tipografia e sombras. Nunca usar valores hardcoded
// nas telas — sempre importar daqui.
// ============================================

export const COLORS = {
  // Paleta principal
  primary:    '#7B2FBE',  // Roxo Galáxia
  secondary:  '#B57BEE',  // Lilás Nebulosa
  surface:    '#F5F0FF',  // Branco Estelar
  premium:    '#FFD700',  // Dourado Cósmico
  background: '#0D0D1A',  // Preto Espacial
  accent:     '#E040FB',  // Rosa Sintonia
  success:    '#00E676',  // Verde Aurora
  warning:    '#FFB300',  // Âmbar Cósmico
  error:      '#FF1744',  // Vermelho Supernova

  // Superfícies
  card:        '#1A0A2E',
  cardLight:   '#2D1B4E',
  border:      '#3D2B5E',
  borderLight: 'rgba(181, 123, 238, 0.3)',

  // Texto
  textPrimary:   '#F5F0FF',
  textSecondary: '#B57BEE',
  textMuted:     'rgba(245, 240, 255, 0.5)',
  textDark:      '#0D0D1A',

  // Overlay
  overlay:      'rgba(13, 13, 26, 0.8)',
  overlayLight: 'rgba(13, 13, 26, 0.4)',
} as const;

export const TIER_COLORS = {
  comum:    '#9E9E9E',
  raro:     '#C0C0C0',
  epico:    '#B57BEE',
  lendario: '#FFD700',
  galaxia:  '#7B2FBE',
} as const;

export const TIER_GLOW = {
  comum:    'transparent',
  raro:     'rgba(192, 192, 192, 0.3)',
  epico:    'rgba(181, 123, 238, 0.4)',
  lendario: 'rgba(255, 215, 0, 0.4)',
  galaxia:  'rgba(123, 47, 190, 0.6)',
} as const;

export const GRADIENTS = {
  primary:   ['#7B2FBE', '#B57BEE'] as string[],
  premium:   ['#FFD700', '#FFA000'] as string[],
  galaxia:   ['#0D0D1A', '#1A0A2E', '#7B2FBE'] as string[],
  sintonia:  ['#E040FB', '#7B2FBE'] as string[],
  estelar:   ['#B57BEE', '#F5F0FF'] as string[],
  card:      ['#1A0A2E', '#2D1B4E'] as string[],
  success:   ['#00E676', '#00BFA5'] as string[],
  warning:   ['#FFB300', '#FF6F00'] as string[],
  error:     ['#FF1744', '#D50000'] as string[],
} as const;

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
  xxxl: 64,
} as const;

export const BORDER_RADIUS = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  full: 999,
} as const;

export const FONT_SIZE = {
  xs:   11,
  sm:   12,
  md:   14,
  lg:   16,
  xl:   18,
  xxl:  22,
  hero: 28,
  display: 36,
} as const;

export const FONT_WEIGHT = {
  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
} as const;

export const SHADOWS = {
  none: {
    shadowColor:   'transparent',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius:  0,
    elevation:     0,
  },
  sm: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius:  4,
    elevation:     4,
  },
  primary: {
    shadowColor:   '#7B2FBE',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius:  8,
    elevation:     8,
  },
  premium: {
    shadowColor:   '#FFD700',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius:  12,
    elevation:     12,
  },
  galaxia: {
    shadowColor:   '#7B2FBE',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius:  16,
    elevation:     16,
  },
} as const;

export const ANIMATION = {
  fast:   150,
  normal: 300,
  slow:   500,
  xslow:  800,
} as const;

export const ICON_SIZE = {
  xs:  16,
  sm:  20,
  md:  24,
  lg:  32,
  xl:  48,
  xxl: 64,
} as const;

// Tipos exportados
export type ColorKey      = keyof typeof COLORS;
export type TierKey       = keyof typeof TIER_COLORS;
export type GradientKey   = keyof typeof GRADIENTS;
export type SpacingKey    = keyof typeof SPACING;
export type BorderRadiusKey = keyof typeof BORDER_RADIUS;
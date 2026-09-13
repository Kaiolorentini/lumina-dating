// ============================================
// LUMINA — TEMA DO MARKETPLACE
// src/theme/marketplace.ts
//
// TERCEIRO tema do app, com escopo próprio:
//   src/theme/index.ts   → clássico dourado (Home, Perfil, Chat)
//   src/theme/tokens.ts  → premium roxo (Loja, Galáxia Plus)
//   este arquivo         → marketplace (roxo + dourado)
//
// O marketplace vende conteúdo de criadores por dinheiro real.
// Precisa parecer uma vitrine: profundidade, gradiente e o
// dourado como marca de valor sobre a base roxa do premium.
//
// Reaproveita spacing/borderRadius do tema clássico para não
// criar uma terceira escala de medidas — só cor, sombra e
// tipografia são próprios daqui.
// ============================================

import { spacing, borderRadius } from './index';

export { spacing, borderRadius };

export const MP = {
  // --- Base ---
  bg:            '#0B0716',   // roxo tão escuro que lê como preto
  bgElevated:    '#150E28',
  surface:       '#1C1233',
  surfaceRaised: '#251742',
  surfaceGlass:  'rgba(60, 38, 105, 0.45)',

  // --- Roxo (identidade premium) ---
  purple:        '#7B2FBE',
  purpleLight:   '#B57BEE',
  purpleDeep:    '#4E1B7E',
  purpleGlow:    'rgba(123, 47, 190, 0.35)',
  purpleSubtle:  'rgba(181, 123, 238, 0.12)',

  // --- Dourado (valor, preço, destaque) ---
  gold:          '#D4AF37',
  goldLight:     '#F0D060',
  goldGlow:      'rgba(212, 175, 55, 0.28)',
  goldSubtle:    'rgba(212, 175, 55, 0.10)',

  // --- Bordas ---
  border:        'rgba(181, 123, 238, 0.22)',
  borderGold:    'rgba(212, 175, 55, 0.40)',
  borderStrong:  'rgba(181, 123, 238, 0.45)',

  // --- Texto ---
  text:          '#F5F0FF',
  textSoft:      '#C7B8E0',
  textMuted:     '#7D6E99',
  textOnGold:    '#0B0716',

  // --- Semânticos ---
  success:       '#00E676',
  error:         '#FF4D6D',
  free:          '#00E676',
} as const;

// Gradientes — o card usa CARD, o destaque usa FEATURED.
// Arrays tipados para LinearGradient sem cast em cada uso.
export const MP_GRADIENT = {
  card:     ['#1C1233', '#251742'] as [string, string],
  featured: ['#2A0A4E', '#4E1B7E'] as [string, string],
  // Fundo da tela: preto com brilho dourado na base, como uma
  // vitrine iluminada por baixo. Sutil de propósito — os cards
  // roxos precisam dominar.
  screen:   ['#0B0716', '#120C08', '#1A1206'] as [string, string, string],
  gold:     ['#F0D060', '#D4AF37'] as [string, string],
  purple:   ['#7B2FBE', '#B57BEE'] as [string, string],
  veil:     ['transparent', 'rgba(11, 7, 22, 0.92)'] as [string, string],
} as const;

export const MP_SHADOW = {
  card: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius:  14,
    elevation:     10,
  },
  purpleGlow: {
    shadowColor:   '#7B2FBE',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius:  16,
    elevation:     12,
  },
  goldGlow: {
    shadowColor:   '#D4AF37',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius:  14,
    elevation:     10,
  },
} as const;

export const MP_FONT = {
  size: {
    xs:      10,
    sm:      12,
    md:      14,
    lg:      16,
    xl:      19,
    xxl:     24,
    display: 30,
  },
  weight: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
    heavy:    '800' as const,
  },
  tracking: {
    tight: -0.4,
    normal: 0,
    wide:   0.6,
    wider:  1.4,
  },
} as const;

// Rótulos das categorias em um lugar só — a home e a criação
// de produto duplicavam a lista, e elas divergiam.
export const MP_CATEGORY = {
  fotos:  { label: 'Fotos',  icon: '📷' },
  videos: { label: 'Vídeos', icon: '🎬' },
  cursos: { label: 'Cursos', icon: '🎓' },
  pdfs:   { label: 'PDFs',   icon: '📄' },
  outros: { label: 'Outros', icon: '✧' },
} as const;
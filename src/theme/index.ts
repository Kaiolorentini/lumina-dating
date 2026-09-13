// ============================================
// LUMINA — TEMA CLÁSSICO (dourado sobre preto)
// Escopo: Home, Perfil, ProfileSetup, Chat, componentes globais.
//
// ⚠️ NÃO é o mesmo tema de src/theme/tokens.ts (roxo/premium),
// usado na Loja e nas telas Premium. Os dois convivem por
// escopo, de propósito. Ao criar uma tela nova, escolha um e
// não misture os dois no mesmo componente.
// ============================================
export const colors = {
  background: '#0D0D0D',
  surface: '#1A1A1A',
  gold: '#D4AF37',
  goldLight: '#F0D060',
  goldDark: '#A88B20',
  white: '#FFFFFF',
  gray: '#888888',
  grayLight: '#CCCCCC',
  grayDark: '#444444',
  error: '#FF4444',
  success: '#44FF88',

  // --- Camadas de superfície (v5.5) ---
  // O tema só tinha background e surface: nada se destacava porque
  // tudo dividia o mesmo tom. Estes níveis dão elevação real —
  // quanto mais alto o elemento, mais clara a superfície.
  surfaceRaised:  '#212121',   // card sobre fundo
  surfaceOverlay: '#2A2A2A',   // modal, sheet, elemento sobre card
  surfaceSunken:  '#141414',   // campo de input, área recuada

  // --- Dourado em transparência ---
  // Evita concatenação manual ('gold + 44') espalhada pelo código,
  // que gerava valores inconsistentes entre telas.
  goldGlow:   'rgba(212, 175, 55, 0.18)',
  goldSubtle: 'rgba(212, 175, 55, 0.08)',
  goldBorder: 'rgba(212, 175, 55, 0.35)',

  // --- Texto por hierarquia ---
  textPrimary:   '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted:     '#6E6E6E',

  overlay: 'rgba(0, 0, 0, 0.75)',
};

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
  // Pesos nomeados: antes só existia 'bold' ou nada, e a hierarquia
  // entre título, preço e metadado ficava indistinguível.
  weights: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
    heavy:    '800' as const,
  },
  // Espaçamento entre letras — títulos grandes pedem negativo,
  // labels pequenas em caixa alta pedem positivo.
  tracking: {
    tight:  -0.5,
    normal:  0,
    wide:    0.5,
    wider:   1.2,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 28,
  full: 999,
};

// Elevação — o app inteiro era plano. A sombra dourada é o que
// dá a leitura de "vitrine iluminada" sem precisar de gradiente
// em cada card.
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  lifted: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  glow: {
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 14,
    elevation: 8,
  },
};

export const theme = {
  colors,
  fonts,
  spacing,
  borderRadius,
  shadows,
};

export default theme;
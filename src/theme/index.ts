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
  sm: 8,
  md: 16,
  lg: 24,
  full: 999,
};

export const theme = {
  colors,
  fonts,
  spacing,
  borderRadius,
};

export default theme;
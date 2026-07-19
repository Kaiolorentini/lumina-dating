// ============================================
// LUMINA — DESIGN TOKENS (RE-EXPORT)
// src/theme/tokens.ts
//
// Re-exporta os tokens do theme/index.ts para
// não quebrar imports existentes.
// NUNCA definir tokens aqui — editar index.ts.
// ============================================

export {
  colors,
  COLORS,
  fonts,
  FONT_SIZE,
  FONT_WEIGHT,
  spacing,
  SPACING,
  borderRadius,
  BORDER_RADIUS,
  alpha,

  TIER_COLORS,
  TIER_GLOW,
  GRADIENTS,
  PRESTIGE_STAGES,
  PRESTIGE_COLORS,
  RANK_COLORS,
  RANK_GRADIENTS,
  RARITY_COLORS,
  RARITY_GLOW,
  SINTONIA_COLORS,
  SINTONIA_LABELS,
  SHADOWS,
  ANIMATION,
  ICON_SIZE,

  GLASS,
  ELEVATION,
  PRESS,

  theme,
  default,
} from './index';

export type {
  ColorKey,
  ColorUKey,
  TierKey,
  GradientKey,
  SpacingKey,
  SpacingUKey,
  BorderRadiusKey,
  BorderRadiusUKey,
  FontSizeKey,
  FontSizeUKey,
  FontWeightKey,
  ShadowKey,
  ElevationKey,
  GlassKey,
  AnimationKey,
  IconSizeKey,
} from './index';

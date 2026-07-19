import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';

type BadgeVariant = 'default' | 'premium' | 'success' | 'warning' | 'error' | 'info' | 'outline';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  icon?: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
}

export function Badge({ label, icon, variant = 'default', size = 'md', style }: BadgeProps) {
  const variantStyle = VARIANT_STYLES[variant];
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.base,
        isSmall && styles.small,
        variantStyle.container,
        style,
      ]}
    >
      {icon && <Text style={[styles.icon, isSmall && styles.iconSmall, { color: variantStyle.color }]}>{icon}</Text>}
      <Text
        style={[
          styles.text,
          isSmall && styles.textSmall,
          { color: variantStyle.color },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const VARIANT_STYLES = {
  default: { container: { backgroundColor: 'rgba(255,255,255,0.06)' }, color: COLORS.textSecondary },
  premium: { container: { backgroundColor: alpha(COLORS.gold, 0.12), borderWidth: 1, borderColor: alpha(COLORS.gold, 0.25) }, color: COLORS.gold },
  success: { container: { backgroundColor: alpha(COLORS.success, 0.12), borderWidth: 1, borderColor: alpha(COLORS.success, 0.25) }, color: COLORS.success },
  warning: { container: { backgroundColor: alpha(COLORS.warning, 0.12), borderWidth: 1, borderColor: alpha(COLORS.warning, 0.25) }, color: COLORS.warning },
  error:   { container: { backgroundColor: alpha(COLORS.error, 0.12), borderWidth: 1, borderColor: alpha(COLORS.error, 0.25) }, color: COLORS.error },
  info:    { container: { backgroundColor: alpha(COLORS.accent, 0.12), borderWidth: 1, borderColor: alpha(COLORS.accent, 0.25) }, color: COLORS.accent },
  outline: { container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }, color: COLORS.textSecondary },
};

function alpha(hex: string, opacity: number): string {
  const a = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    gap: 3,
  },
  small: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  icon: {
    fontSize: FONT_SIZE.caption,
    lineHeight: FONT_SIZE.caption + 2,
  },
  iconSmall: {
    fontSize: FONT_SIZE.overline,
    lineHeight: FONT_SIZE.overline + 2,
  },
  text: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: 0.3,
  },
  textSmall: {
    fontSize: FONT_SIZE.overline,
  },
});

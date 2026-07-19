import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, ELEVATION } from '../../theme/tokens';
import { AnimatedPressable } from './AnimatedPressable';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'premium' | 'accent' | 'glass';
  padding?: number;
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Card({
  children,
  variant = 'default',
  padding = SPACING.md,
  onPress,
  style,
  accessibilityLabel,
}: CardProps) {
  const variantStyle = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default;
  const content = (
    <View
      style={[
        styles.base,
        variantStyle,
        { padding },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </AnimatedPressable>
    );
  }

  return content;
}

const VARIANT_STYLES: Record<string, ViewStyle> = {
  default: {
    backgroundColor: COLORS.card,
    ...ELEVATION.flat,
  },
  elevated: {
    backgroundColor: COLORS.card,
    ...ELEVATION.medium,
  },
  premium: {
    backgroundColor: COLORS.card,
    ...ELEVATION.premium,
  },
  accent: {
    backgroundColor: COLORS.card,
    ...ELEVATION.accent,
  },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    ...ELEVATION.flat,
  },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: BORDER_RADIUS.lg,
  },
});

import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from './AnimatedPressable';
import {
  COLORS,
  GRADIENTS,
  FONT_SIZE,
  FONT_WEIGHT,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  alpha,
} from '../../theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'premium' | 'ghost' | 'danger';
type ButtonSize    = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label:      string;
  onPress:    () => void;
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  disabled?:  boolean;
  fullWidth?: boolean;
  icon?:      React.ReactNode;
  style?:     ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  label,
  onPress,
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  disabled  = false,
  fullWidth = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const sizeStyles = SIZE_STYLES[size];
  const variantConfig = VARIANT_CONFIG[variant];

  if (variant === 'primary' || variant === 'premium') {
    const gradient = variant === 'premium' ? GRADIENTS.premium : GRADIENTS.primary;

    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.85}
        style={[
          styles.base,
          sizeStyles.container,
          fullWidth && styles.fullWidth,
          isDisabled && styles.disabled,
          variant === 'premium' ? SHADOWS.premium : SHADOWS.level1,
          style,
        ]}
      >
        <LinearGradient
          colors={gradient as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradient, sizeStyles.container]}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.surface} size="small" />
          ) : (
            <>
              {icon}
              <Text style={[styles.text, sizeStyles.text, textStyle]}>{label}</Text>
            </>
          )}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        styles.base,
        sizeStyles.container,
        {
          backgroundColor: variantConfig.bg,
          borderColor: variantConfig.border,
          borderWidth: variantConfig.borderWidth,
        },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantConfig.textColor} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, sizeStyles.text, { color: variantConfig.textColor }, textStyle]}>
            {label}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const SIZE_STYLES = {
  sm: {
    container: { height: 36, paddingHorizontal: SPACING.md, borderRadius: BORDER_RADIUS.md },
    text:      { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  },
  md: {
    container: { height: 48, paddingHorizontal: SPACING.lg, borderRadius: BORDER_RADIUS.lg },
    text:      { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  },
  lg: {
    container: { height: 56, paddingHorizontal: SPACING.xl, borderRadius: BORDER_RADIUS.xl },
    text:      { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  },
};

const VARIANT_CONFIG = {
  primary: {
    bg:          COLORS.primary,
    border:      'transparent',
    borderWidth: 0,
    textColor:   COLORS.surface,
  },
  secondary: {
    bg:          alpha(COLORS.accent, 0.12),
    border:      COLORS.accent,
    borderWidth: 1,
    textColor:   COLORS.accent,
  },
  premium: {
    bg:          COLORS.premium,
    border:      'transparent',
    borderWidth: 0,
    textColor:   COLORS.background,
  },
  ghost: {
    bg:          'transparent',
    border:      alpha(COLORS.accent, 0.35),
    borderWidth: 1,
    textColor:   COLORS.accent,
  },
  danger: {
    bg:          alpha(COLORS.error, 0.12),
    border:      COLORS.error,
    borderWidth: 1,
    textColor:   COLORS.error,
  },
};

const styles = StyleSheet.create({
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            SPACING.sm,
    overflow:       'hidden',
  },
  gradient: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            SPACING.sm,
    width:          '100%',
  },
  text: {
    letterSpacing: 0.3,
    color:         COLORS.surface,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
});

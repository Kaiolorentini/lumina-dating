import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput as RNTextInput,
  StyleSheet,
  LayoutAnimation,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, alpha } from '../../theme/tokens';
import { useScalePress, useRippleEffect } from '../../hooks';

interface InputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: any;
  onFocus?: () => void;
  onBlur?: () => void;
  onPress?: () => void;
  rippleColor?: string;
  value?: string;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  accessibilityLabel?: string;
  [key: string]: any;
}

export function EnhancedInput({
  label,
  error,
  leftIcon,
  rightIcon,
  containerStyle,
  onFocus,
  onBlur,
  onPress,
  rippleColor = COLORS.primary,
  value,
  placeholder,
  multiline = false,
  numberOfLines = 1,
  accessibilityLabel,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const scaleAnimation = useScalePress(0.98);
  const { ripples, triggerRipple } = useRippleEffect();
  const [rippleKey, setRippleKey] = useState(0);

  const handlePressIn = () => {
    scaleAnimation.handlePressIn();
    if (onPress) onPress();
  };

  const handlePressOut = () => {
    scaleAnimation.handlePressOut();
  };

  const handleLayout = (event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    triggerRipple(x + width / 2, y + height / 2);
    setRippleKey(prev => prev + 1);
  };

  const borderColor = error
    ? COLORS.error
    : focused
    ? COLORS.gold
    : 'rgba(255, 255, 255, 0.08)';

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, error && { color: COLORS.error }]}>{label}</Text>
        </View>
      )}

      <TouchableOpacity
        activeOpacity={0.8}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLayout={handleLayout}
        style={styles.touchableArea}
      >
        <View style={[styles.container, { borderColor }, focused && styles.focused]}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <RNTextInput
            style={[styles.input, multiline && styles.multilineInput]}
            placeholderTextColor="rgba(255, 255, 255, 0.35)"
            onFocus={(e) => {
              setFocused(true);
              onFocus?.();
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.();
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            }}
            value={value}
            placeholder={placeholder}
            multiline={multiline}
            numberOfLines={numberOfLines}
            accessibilityLabel={accessibilityLabel || label}
            accessibilityHint={error || undefined}
            {...rest}
          />
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
      </TouchableOpacity>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {ripples.map((ripple: { id: number; x: number; y: number }) => (
        <View
          key={ripple.id}
          style={[styles.ripple, { left: ripple.x - 20, top: ripple.y - 20, backgroundColor: rippleColor }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: SPACING.xs,
  },
  labelContainer: {
    marginBottom: 2,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  touchableArea: {
    borderRadius: BORDER_RADIUS.md,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    height: 56,
    overflow: 'hidden',
  },
  focused: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    ...SHADOWS.level1,
    borderColor: COLORS.gold,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.body,
    height: '100%',
    paddingVertical: 0,
  },
  multilineInput: {
    height: 'auto',
    minHeight: 56,
    textAlignVertical: 'top',
    paddingTop: SPACING.md,
  },
  iconLeft: {
    marginRight: SPACING.sm,
    opacity: 0.7,
  },
  iconRight: {
    marginLeft: SPACING.sm,
    opacity: 0.7,
  },
  errorContainer: {
    marginTop: 4,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
  },
  ripple: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.3,
    transform: [{ scale: 0 }],
  },
});

export { EnhancedInput as Input };

const rippleKeyframes = {
  '0%': { transform: [{ scale: 0 }], opacity: 0.3 },
  '100%': { transform: [{ scale: 2 }], opacity: 0 },
};

if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ripple-animation {
      0% { transform: scale(0); opacity: 0.3; }
      100% { transform: scale(2); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}
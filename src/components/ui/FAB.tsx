import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Animated, Easing } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, alpha, SHADOWS } from '../../theme/tokens';

interface FABProps {
  icon: React.ReactNode;
  onPress: () => void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  style?: any;
}

export function FAB({
  icon,
  onPress,
  label,
  size = 'md',
  variant = 'primary',
  position = 'bottom-right',
  style,
}: FABProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      damping: 15,
      stiffness: 150,
      useNativeDriver: true,
    }).start();
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [scale, opacity]);

  const sizeStyles = {
    sm: { width: 40, height: 40, iconSize: 20 },
    md: { width: 56, height: 56, iconSize: 24 },
    lg: { width: 72, height: 72, iconSize: 32 },
  };

  const variantStyles = {
    primary: { backgroundColor: COLORS.primary },
    secondary: { backgroundColor: COLORS.secondary },
    ghost: {
      backgroundColor: alpha(COLORS.surface, 0.1),
      borderWidth: 1,
      borderColor: COLORS.border,
    },
  };

  const positionStyles = {
    'bottom-right': { bottom: SPACING.xl, right: SPACING.xl },
    'bottom-left': { bottom: SPACING.xl, left: SPACING.xl },
    'top-right': { top: SPACING.xl, right: SPACING.xl },
    'top-left': { top: SPACING.xl, left: SPACING.xl },
    center: {
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
  };

  return (
    <Animated.View
      style={[styles.fab,
        sizeStyles[size],
        variantStyles[variant],
        positionStyles[position],
        { transform: [{ scale }], opacity },
        style,
      ]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.touchable}>
        {icon}
        {label && (
          <Text style={[styles.label, sizeStyles[size]]}>{label}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    borderRadius: BORDER_RADIUS.full,
    ...SHADOWS.level3,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
  },
  label: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    marginLeft: SPACING.sm,
  },
});
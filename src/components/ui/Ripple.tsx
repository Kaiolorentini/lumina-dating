import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Animated, Easing } from 'react-native';
import { COLORS } from '../../theme/tokens';

const { width } = Dimensions.get('window');

interface RippleProps {
  x: number;
  y: number;
  size?: number;
  color?: string;
  duration?: number;
  onComplete?: () => void;
}

export function Ripple({ x, y, size = 0, color = COLORS.secondary, duration = 400, onComplete }: RippleProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onComplete?.();
    });
  }, [animatedValue, duration, onComplete]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 0.3, 0],
  });

  return (
    <Animated.View
      style={[
        styles.ripple,
        {
          left: x - (size || 20),
          top: y - (size || 20),
          width: size || 40,
          height: size || 40,
          borderRadius: (size || 40) / 2,
          backgroundColor: color,
          transform: [{ scale: animatedValue }],
          opacity,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ripple: {
    position: 'absolute',
    borderRadius: 9999,
  },
});

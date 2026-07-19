import React, { useRef, useCallback } from 'react';
import { Animated, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { PRESS } from '../../theme/tokens';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface AnimatedPressableProps extends TouchableOpacityProps {
  scaleTo?: number;
}

export function AnimatedPressable({
  children,
  onPressIn,
  onPressOut,
  scaleTo = PRESS.scale,
  style,
  ...rest
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback((e: any) => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      ...PRESS.spring,
    }).start();
    onPressIn?.(e);
  }, [scale, scaleTo, onPressIn]);

  const handlePressOut = useCallback((e: any) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      ...PRESS.spring,
    }).start();
    onPressOut?.(e);
  }, [scale, onPressOut]);

  return (
    <AnimatedTouchable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[{ transform: [{ scale }] }, style as any]}
      {...rest}
    >
      {children}
    </AnimatedTouchable>
  );
}

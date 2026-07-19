import React, { useEffect, useRef } from 'react';
import { Animated, ViewProps } from 'react-native';

interface FadeInViewProps extends ViewProps {
  duration?: number;
  delay?: number;
  slideOffset?: number;
}

export function FadeInView({
  children,
  duration = 400,
  delay = 0,
  slideOffset = 0,
  style,
  ...rest
}: FadeInViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slideOffset)).current;

  useEffect(() => {
    const animations: ReturnType<typeof Animated.timing>[] = [
      Animated.timing(opacity, { toValue: 1, duration, delay, useNativeDriver: true }),
    ];
    if (slideOffset > 0) {
      animations.push(
        Animated.timing(translateY, { toValue: 0, duration, delay, useNativeDriver: true })
      );
    }
    Animated.parallel(animations).start();
  }, [opacity, translateY, duration, delay, slideOffset]);

  return (
    <Animated.View
      style={[
        { opacity, transform: slideOffset > 0 ? [{ translateY }] : [] },
        style,
      ]}
      {...rest}
    >
      {children}
    </Animated.View>
  );
}

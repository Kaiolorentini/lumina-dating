import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput as RNTextInput,
  TextInputProps,
  Animated,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
} from 'react-native-reanimated';
import { COLORS } from '../theme/tokens';

export function useFadeInView(
  duration = 400,
  delay = 0,
  slideOffset = 20,
) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slideOffset)).current;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [duration, delay]);

  return {
    style: {
      opacity,
      transform: [{ translateY }],
    },
    isVisible,
  };
}

export function useTextInputEvents(onFocus?: () => void, onBlur?: () => void) {
  const [focused, setFocused] = useState(false);

  const handleFocus = () => {
    setFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setFocused(false);
    onBlur?.();
  };

  return { focused, handleFocus, handleBlur };
}

export function useLongPressText(
  duration = 500,
  onLongPress?: () => void,
  threshold = 0.5,
) {
  const [pressDuration, setPressDuration] = useState(0);
  const pressStart = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handlePressStart = () => {
    pressStart.current = Date.now();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      const elapsed = Date.now() - pressStart.current!;
      if (elapsed >= duration * threshold) {
        onLongPress?.();
      }
    }, duration);
  };

  const handlePressEnd = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const elapsed = pressStart.current ? Date.now() - pressStart.current : 0;
    setPressDuration(elapsed);
    pressStart.current = null;
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    pressDuration,
    handlePressStart,
    handlePressEnd,
    isLongPress: pressDuration >= duration * threshold,
  };
}

export function useTouchRipple(
  color = COLORS.primary,
  duration = 300,
) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const nextId = useRef(0);

  const triggerRipple = (x: number, y: number) => {
    const id = nextId.current++;
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, duration);
  };

  return { ripples, triggerRipple };
}

export function useFocusEffect(onFocus?: () => void, onBlur?: () => void) {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  return {
    isFocused,
    handleFocus,
    handleBlur,
    focusProps: {
      onFocus: handleFocus,
      onBlur: handleBlur,
    },
  };
}

export function usePressFeedback() {
  const [isPressed, setIsPressed] = useState(false);

  const handlePressIn = () => setIsPressed(true);
  const handlePressOut = () => setIsPressed(false);

  return {
    isPressed,
    handlePressIn,
    handlePressOut,
    pressProps: {
      onPressIn: handlePressIn,
      onPressOut: handlePressOut,
    },
  };
}

export function useHoverFeedback() {
  const [isHovering, setIsHovering] = useState(false);

  const handleHoverIn = () => setIsHovering(true);
  const handleHoverOut = () => setIsHovering(false);

  return {
    isHovering,
    handleHoverIn,
    handleHoverOut,
    hoverProps: {
      onHoverIn: handleHoverIn,
      onHoverOut: handleHoverOut,
    },
  };
}

export function useScalePress(targetScale = 0.95, duration = 150) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: targetScale,
      duration,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start();
  };

  return { scale, handlePressIn, handlePressOut };
}

export function usePulse(
  enabled = true,
  min = 1,
  max = 1.05,
  duration = 2000,
) {
  const scale = useRef(new Animated.Value(min)).current;

  useEffect(() => {
    if (!enabled) {
      scale.setValue(min);
      return;
    }
    scale.setValue(min);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: max,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: min,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [enabled, min, max, duration, scale]);

  return { scale };
}

export function useFadeIn(duration = 400, delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [duration, delay, opacity]);

  return { opacity, visible };
}

export function useTextPress() {
  return {};
}

export function useRippleEffect() {
  const [ripples, setRipples] = useState<
    { id: number; x: number; y: number }[]
  >([]);
  const nextId = useRef(0);

  const triggerRipple = (x: number, y: number) => {
    const id = nextId.current++;
    setRipples((prev) => [...prev, { id, x, y }]);
  };

  return { ripples, triggerRipple };
}

export function useProgressBar(initial = 0) {
  const [progress, setProgressState] = useState(initial);
  const animated = useRef(new Animated.Value(initial)).current;

  const animateTo = (toValue: number, duration = 300) => {
    Animated.timing(animated, {
      toValue,
      duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setProgressState(toValue);
    });
  };

  const setProgress = (value: number) => {
    animated.setValue(value);
    setProgressState(value);
  };

  return { progress, animateTo, setProgress };
}

export function useShimmer() {
  return {};
}

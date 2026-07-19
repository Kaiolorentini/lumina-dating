import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../theme/tokens';

interface OfflineBannerProps {
  visible: boolean;
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  const translateY = new Animated.Value(visible ? 0 : -40);

  React.useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : -40,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      <Text style={styles.dot}>●</Text>
      <Text style={styles.text}>Sem conexão — tentando reconectar...</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 900,
    backgroundColor: COLORS.error,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  dot: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.xs,
  },
  text: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
  },
});

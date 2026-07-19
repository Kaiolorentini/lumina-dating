import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, alpha } from '../../theme/tokens';
import { Button } from './Button';

type EmptyStateTone = 'default' | 'success' | 'error' | 'info';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  elevated?: boolean;
  tone?: EmptyStateTone;
}

const TONE_ICON_BG: Record<EmptyStateTone, string> = {
  default: alpha(COLORS.gold, 0.1),
  success: alpha(COLORS.success, 0.12),
  error: alpha(COLORS.error, 0.12),
  info: alpha(COLORS.secondary, 0.12),
};

const TONE_ICON_COLOR: Record<EmptyStateTone, string> = {
  default: COLORS.gold,
  success: COLORS.success,
  error: COLORS.error,
  info: COLORS.secondary,
};

export function EmptyState({
  icon = '✦',
  title,
  subtitle,
  actionLabel,
  onAction,
  elevated,
  tone = 'default',
}: EmptyStateProps) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, damping: 18, stiffness: 140, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Animated.View style={[styles.container, elevated && styles.elevated, { opacity }]}>
      <Animated.View style={[styles.iconCircle, { backgroundColor: TONE_ICON_BG[tone], transform: [{ scale }] }]}>
        <Text style={[styles.icon, { color: TONE_ICON_COLOR[tone] }]}>{icon}</Text>
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant={tone === 'error' ? 'danger' : 'primary'}
          size="md"
          style={styles.button}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  elevated: {
    margin: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.lg,
  },
  button: {
    marginTop: SPACING.sm,
  },
});

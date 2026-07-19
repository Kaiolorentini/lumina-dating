import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Animated } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, alpha } from '../../theme/tokens';

interface ProgressBarProps {
  progress: number; // 0-1
  height?: number;
  showPercentage?: boolean;
  label?: string;
  color?: string;
  backgroundColor?: string;
  style?: any;
}

export function ProgressBar({
  progress,
  height = 8,
  showPercentage = false,
  label,
  color = COLORS.secondary,
  backgroundColor = alpha(COLORS.textSecondary, 0.1),
  style,
}: ProgressBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {showPercentage && (
            <Text style={styles.percentage}>{Math.round(progress * 100)}%</Text>
          )}
        </View>
      )}

      <View style={[styles.track, { height, backgroundColor }]}>
        <Animated.View
          style={[styles.fill,
            { width: `${progress * 100}%`, backgroundColor },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  percentage: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  track: {
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
});
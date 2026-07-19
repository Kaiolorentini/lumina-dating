import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../theme/tokens';
import { getSintoniaColor, getSintoniaLabel } from '../utils/sintoniaEngine';

interface Props {
  score: number;
  showLabel?: boolean;
  showBreakdown?: boolean;
  breakdown?: {
    localizacao: number;
    preferencia: number;
    perfil: number;
    interesses: number;
  };
}

export default function SintoniaBar({
  score,
  showLabel = true,
  showBreakdown = false,
  breakdown,
}: Props) {
  const animWidth = useRef(new Animated.Value(0)).current;
  const color = getSintoniaColor(score);
  const label = getSintoniaLabel(score);

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: score,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [score]);

  return (
    <View style={styles.container}>
      {/* Score e Label */}
      {showLabel && (
        <View style={styles.header}>
          <Text style={[styles.score, { color }]}>{score}% de Sintonia</Text>
          <Text style={[styles.label, { color }]}>{label}</Text>
        </View>
      )}

      {/* Barra animada */}
      <View style={styles.barBackground}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              width: animWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Breakdown detalhado */}
      {showBreakdown && breakdown && (
        <View style={styles.breakdown}>
          <BreakdownItem
            label="📍 Localização"
            value={breakdown.localizacao}
            max={25}
          />
          <BreakdownItem
            label="💫 Preferência"
            value={breakdown.preferencia}
            max={35}
          />
          <BreakdownItem
            label="👤 Perfil"
            value={breakdown.perfil}
            max={25}
          />
          <BreakdownItem
            label="✨ Interesses"
            value={breakdown.interesses}
            max={15}
          />
        </View>
      )}
    </View>
  );
}

function BreakdownItem({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const percentage = Math.round((value / max) * 100);
  const color = getSintoniaColor(percentage);

  return (
    <View style={styles.breakdownItem}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <View style={styles.breakdownBarBg}>
        <View
          style={[
            styles.breakdownBarFill,
            {
              width: `${percentage}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text style={[styles.breakdownValue, { color }]}>{value}/{max}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  score: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.bold,
  },
  label: {
    fontSize: FONT_SIZE.caption,
  },
  barBackground: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  breakdown: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  breakdownLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    width: 100,
  },
  breakdownBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  breakdownValue: {
    fontSize: FONT_SIZE.xs,
    width: 35,
    textAlign: 'right',
  },
});
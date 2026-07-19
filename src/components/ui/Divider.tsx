import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../theme/tokens';

interface DividerProps {
  label?: string;
  color?: string;
  style?: ViewStyle;
}

export function Divider({ label, color = COLORS.border, style }: DividerProps) {
  if (label) {
    return (
      <View style={[styles.withLabel, style]}>
        <View style={[styles.line, { backgroundColor: color }]} />
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.line, { backgroundColor: color }]} />
      </View>
    );
  }

  return <View style={[styles.line, { backgroundColor: color }, styles.fullWidth, style]} />;
}

const styles = StyleSheet.create({
  line: {
    height: 1,
  },
  fullWidth: {
    width: '100%',
    marginVertical: SPACING.md,
  },
  withLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginVertical: SPACING.md,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

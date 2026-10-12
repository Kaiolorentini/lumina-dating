// ============================================
// LUMINA — BARRA DE SINTONIA v2
// src/components/SintoniaBar.tsx
//
// 12/10/2026 — Sintonia v2: os quatro blocos novos (interesse mútuo,
// idade, localização, interesses em comum), com uma frase que
// explica o que pesou — a pessoa entende o número em vez de só ver
// uma porcentagem.
// ============================================

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../theme';
import { getSintoniaColor, getSintoniaLabel } from '../utils/sintoniaEngine';
import {
  SINTONIA_BREAKDOWN_MAX, SintoniaBreakdown,
} from '../modules/ai/services/sintoniaCalculator';
import { interestLabel } from '../config/sintonia/interestsCatalog';

interface Props {
  score: number;
  showLabel?: boolean;
  showBreakdown?: boolean;
  breakdown?: SintoniaBreakdown;
}

/** Frases curtas que explicam a nota. */
function explain(b: SintoniaBreakdown): string[] {
  const lines: string[] = [];
  if (b.mutual === 'both') lines.push('💞 Vocês têm interesse um pelo outro.');
  else if (b.mutual === 'one') lines.push('↔️ Só um de vocês tem interesse pelo outro — a Sintonia fica no máximo em 35%.');
  else lines.push('↔️ As preferências de vocês não combinam — a Sintonia fica no máximo em 35%.');

  if (b.localizacao >= SINTONIA_BREAKDOWN_MAX.localizacao) lines.push('📍 Vocês estão na mesma cidade.');
  else if (b.localizacao >= 12) lines.push('📍 Vocês estão no mesmo estado.');

  if (b.commonInterests.length > 0) {
    lines.push(`✨ Em comum: ${b.commonInterests.map(interestLabel).join(', ')}.`);
  } else if (!b.interestsKnown) {
    lines.push('✨ Interesses ainda não informados por um de vocês.');
  }
  return lines;
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
  }, [score, animWidth]);

  return (
    <View style={styles.container}>
      {showLabel && (
        <View style={styles.header}>
          <Text style={[styles.score, { color }]}>{score}% de Sintonia</Text>
          <Text style={[styles.label, { color }]}>{label}</Text>
        </View>
      )}

      <View
        style={styles.barBackground}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: score }}
      >
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

      {showBreakdown && breakdown && (
        <View style={styles.breakdown}>
          <BreakdownItem label="💞 Interesse mútuo" value={breakdown.interesseMutuo} max={SINTONIA_BREAKDOWN_MAX.interesseMutuo} />
          <BreakdownItem label="🎂 Idade" value={breakdown.idade} max={SINTONIA_BREAKDOWN_MAX.idade} />
          <BreakdownItem label="📍 Localização" value={breakdown.localizacao} max={SINTONIA_BREAKDOWN_MAX.localizacao} />
          <BreakdownItem label="✨ Interesses" value={breakdown.interesses} max={SINTONIA_BREAKDOWN_MAX.interesses} />
          <View style={styles.explain}>
            {explain(breakdown).map(line => (
              <Text key={line} style={styles.explainText}>{line}</Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function BreakdownItem({ label, value, max }: { label: string; value: number; max: number }) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
  const color = getSintoniaColor(percentage);

  return (
    <View style={styles.breakdownItem} accessible accessibilityLabel={`${label}: ${value} de ${max}`}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <View style={styles.breakdownBarBg}>
        <View style={[styles.breakdownBarFill, { width: `${percentage}%` as const, backgroundColor: color }]} />
      </View>
      <Text style={[styles.breakdownValue, { color }]}>{value}/{max}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  score: { fontSize: fonts.sizes.md, fontWeight: 'bold' },
  label: { fontSize: fonts.sizes.sm },
  barBackground: {
    height: 6, backgroundColor: colors.grayDark, borderRadius: borderRadius.full, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: borderRadius.full },
  breakdown: { marginTop: spacing.md, gap: spacing.sm },
  breakdownItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  breakdownLabel: { color: colors.gray, fontSize: fonts.sizes.xs, width: 116 },
  breakdownBarBg: {
    flex: 1, height: 4, backgroundColor: colors.grayDark, borderRadius: borderRadius.full, overflow: 'hidden',
  },
  breakdownBarFill: { height: '100%', borderRadius: borderRadius.full },
  breakdownValue: { fontSize: fonts.sizes.xs, width: 38, textAlign: 'right' },
  explain: { marginTop: spacing.xs, gap: 4 },
  explainText: { color: colors.grayLight, fontSize: fonts.sizes.xs, lineHeight: 17 },
});

// ============================================
// LUMINA — XP BAR COMPONENT v5.1
// src/components/XPBar.tsx
// Barra de progresso de XP reutilizável
// ============================================

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme/tokens';

interface Props {
  level:       number;
  tier:        string;
  totalXP:     number;
  nextLevelXP: number;
  progress:    number; // 0-1
  compact?:    boolean;
}

export default function XPBar({ level, tier, totalXP, nextLevelXP, progress, compact }: Props) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue:       progress,
      duration:      800,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  if (compact) {
    return (
      <View style={styles.compact}>
        <Text style={styles.compactLevel}>Nv {level}</Text>
        <View style={styles.compactBar}>
          <Animated.View style={[
            styles.compactFill,
            { width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]} />
        </View>
        <Text style={styles.compactTier}>{tier.split(' ')[0]}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.level}>Nível {level}</Text>
        <Text style={styles.tier}>{tier}</Text>
        <Text style={styles.xp}>{totalXP} XP</Text>
      </View>
      <View style={styles.bar}>
        <Animated.View style={[
          styles.fill,
          { width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]} />
      </View>
      <Text style={styles.next}>Próximo nível: {nextLevelXP} XP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.xs },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  level:     { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  tier:      { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
  xp:        { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  bar:       { height: 8, backgroundColor: COLORS.border, borderRadius: BORDER_RADIUS.full, overflow: 'hidden' },
  fill:      { height: '100%', backgroundColor: COLORS.secondary, borderRadius: BORDER_RADIUS.full },
  next:      { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'right' },

  // Compact
  compact:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  compactLevel: { color: COLORS.secondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, width: 32 },
  compactBar:   { flex: 1, height: 4, backgroundColor: COLORS.border, borderRadius: BORDER_RADIUS.full, overflow: 'hidden' },
  compactFill:  { height: '100%', backgroundColor: COLORS.secondary, borderRadius: BORDER_RADIUS.full },
  compactTier:  { fontSize: FONT_SIZE.sm, width: 24 },
});
// ============================================
// LUMINA — MISSIONS BANNER v5.2
// src/components/MissionsBanner.tsx
// Banner clicável na HomeScreen
// ============================================

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../theme';

interface Props {
  completedCount: number;
  totalCount:     number;
  onPress:        () => void;
}

export default function MissionsBanner({ completedCount, totalCount, onPress }: Props) {
  const allDone = completedCount >= totalCount;

  return (
    <TouchableOpacity style={styles.wrapper} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.banner, allDone && styles.bannerDone]}>
        <Text style={styles.icon}>{allDone ? '✅' : '📋'}</Text>
        <View style={styles.info}>
          <Text style={styles.title}>Missões do Dia</Text>
          <Text style={styles.sub}>
            {allDone
              ? 'Todas concluídas! Parabéns 🎉'
              : `${completedCount}/${totalCount} concluídas`}
          </Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.lg,
    marginTop:        spacing.xs,
    marginBottom:     spacing.xs,
    borderRadius:     borderRadius.md,
    overflow:         'hidden',
    borderWidth:      1,
    borderColor:      colors.primaryLegacy,
  },
  banner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardLegacy, padding: spacing.md, gap: spacing.sm },
  bannerDone: { borderColor: '#4CAF50', backgroundColor: '#0A1A0A' },
  icon:       { fontSize: fonts.sizes.xxl },
  info:       { flex: 1 },
  title:      { color: colors.secondaryLegacy, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  sub:        { color: '#888', fontSize: fonts.sizes.xs, marginTop: 2 },
  arrow:      { color: colors.primaryLegacy, fontSize: 24, fontWeight: 'bold' },
});
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
    borderColor:      '#7B2FBE',
  },
  banner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A0A2E', padding: spacing.md, gap: spacing.sm },
  bannerDone: { borderColor: '#4CAF50', backgroundColor: '#0A1A0A' },
  icon:       { fontSize: 28 },
  info:       { flex: 1 },
  title:      { color: '#B57BEE', fontSize: fonts.sizes.md, fontWeight: 'bold' },
  sub:        { color: '#888', fontSize: fonts.sizes.xs, marginTop: 2 },
  arrow:      { color: '#7B2FBE', fontSize: 24, fontWeight: 'bold' },
});
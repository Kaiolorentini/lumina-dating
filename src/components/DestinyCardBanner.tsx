// ============================================
// LUMINA — DESTINY CARD BANNER v5.1
// src/components/DestinyCardBanner.tsx
// ============================================

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing, borderRadius } from '../theme';

interface Props { onPress: () => void; }

export default function DestinyCardBanner({ onPress }: Props) {
  return (
    <TouchableOpacity style={styles.wrapper} onPress={onPress} activeOpacity={0.85}>
      <LinearGradient colors={[colors.cardLegacy, '#2D1B4E']} style={styles.banner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={styles.icon}>🃏</Text>
        <View style={styles.info}>
          <Text style={styles.title}>Carta do Destino</Text>
          <Text style={styles.sub}>O universo escolheu perfis para você hoje</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.xs, borderRadius: borderRadius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.primaryLegacy },
  banner:  { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  icon:    { fontSize: fonts.sizes.xxl },
  info:    { flex: 1 },
  title:   { color: colors.secondaryLegacy, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  sub:     { color: '#888', fontSize: fonts.sizes.xs, marginTop: 2 },
  arrow:   { color: colors.primaryLegacy, fontSize: 24, fontWeight: 'bold' },
});
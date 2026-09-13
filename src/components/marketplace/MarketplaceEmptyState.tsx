// ============================================
// LUMINA — EMPTY STATE DO MARKETPLACE
// src/components/marketplace/MarketplaceEmptyState.tsx
//
// Usado na home, favoritos e compras. Migrado para o tema do
// marketplace: no tema clássico ele destoava do fundo roxo.
// ============================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MP, MP_FONT, spacing, borderRadius } from '../../theme/marketplace';

interface Props {
  icon?: string;
  title: string;
  subtitle?: string;
}

export function MarketplaceEmptyState({ icon = '📭', title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      {/* O ícone dentro de um círculo tem mais presença que solto
          no vazio — o estado vazio antigo parecia tela quebrada. */}
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: borderRadius.full,
    backgroundColor: MP.surface,
    borderWidth: 1,
    borderColor: MP.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  icon: { fontSize: 36 },
  title: {
    color: MP.text,
    fontSize: MP_FONT.size.lg,
    fontWeight: MP_FONT.weight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: MP.textMuted,
    fontSize: MP_FONT.size.md,
    textAlign: 'center',
    lineHeight: 20,
  },
});
// ============================================
// LUMINA — CRYSTAL DISPLAY COMPONENT
// src/components/economy/CrystalDisplay.tsx
//
// Exibe saldo de Cristais de Sintonia.
// Usa Design System oficial.
// Diferencia Gratuito e Premium visualmente.
// ============================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, SPACING, BORDER_RADIUS, SHADOWS, alpha } from '../../theme/tokens';
import { ECONOMY_ASSETS } from '../../assets';
import { Wallet } from '../../shared/types';

interface CrystalDisplayProps {
  wallet:       Wallet | null;
  variant?:     'full' | 'compact' | 'header';
  showPremium?: boolean;
  onPress?:     () => void;
}

export function CrystalDisplay({
  wallet,
  variant     = 'compact',
  showPremium = false,
  onPress,
}: CrystalDisplayProps) {
  const gratuitos = wallet?.coinsGratuitos ?? 0;
  const premium   = wallet?.coinsPremium   ?? 0;
  const total     = gratuitos + premium;

  const formatAmount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  if (variant === 'header') {
    return (
      <TouchableOpacity
        style={styles.headerContainer}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {/* Ícone do cristal — placeholder até asset chegar */}
        <View style={styles.crystalIconPlaceholder} />
        <Text style={styles.headerAmount}>{formatAmount(total)}</Text>
        {premium > 0 && (
          <View style={styles.premiumDot} />
        )}
      </TouchableOpacity>
    );
  }

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.crystalIconPlaceholder} />
        <Text style={styles.compactAmount}>{formatAmount(total)}</Text>
        <Text style={styles.compactLabel}>Cristais</Text>
      </TouchableOpacity>
    );
  }

  // variant === 'full'
  return (
    <TouchableOpacity
      style={styles.fullContainer}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text style={styles.fullTitle}>✨ Cristais de Sintonia</Text>

      <View style={styles.fullRow}>
        {/* Gratuitos */}
        <View style={styles.fullItem}>
          <View style={[styles.crystalIconPlaceholder, styles.iconLg]} />
          <Text style={styles.fullAmount}>{formatAmount(gratuitos)}</Text>
          <Text style={styles.fullLabel}>Gratuitos</Text>
        </View>

        <View style={styles.divider} />

        {/* Premium */}
        <View style={styles.fullItem}>
          <View style={[styles.crystalIconPlaceholder, styles.iconLg, styles.iconPremium]} />
          <Text style={[styles.fullAmount, styles.premiumAmount]}>{formatAmount(premium)}</Text>
          <Text style={[styles.fullLabel, styles.premiumLabel]}>Premium 💎</Text>
        </View>
      </View>

      {/* Fragmentos */}
      {(wallet?.fragments ?? 0) > 0 && (
        <View style={styles.fragmentsRow}>
          <View style={styles.fragmentIconPlaceholder} />
          <Text style={styles.fragmentsText}>
            {wallet?.fragments ?? 0} Fragmentos
          </Text>
          <Text style={styles.fragmentsNote}>
            ({Math.floor((wallet?.fragments ?? 0) / 100)} cristais ao converter)
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Header variant
  headerContainer: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: alpha(COLORS.primaryLegacy, 0.2),
    paddingHorizontal: SPACING.sm,
    paddingVertical:   SPACING.xs,
    borderRadius:   BORDER_RADIUS.full,
    borderWidth:    1,
    borderColor:    alpha(COLORS.secondaryLegacy, 0.4),
    gap: SPACING.xs,
  },
  headerAmount: {
    color:      COLORS.surface,
    fontSize:   FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  premiumDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: COLORS.premium,
  },

  // Compact variant
  compactContainer: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.xs,
  },
  compactAmount: {
    color:      COLORS.surface,
    fontSize:   FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  compactLabel: {
    color:      COLORS.textSecondary,
    fontSize:   FONT_SIZE.sm,
  },

  // Full variant
  fullContainer: {
    backgroundColor: alpha(COLORS.cardLegacy, 0.9),
    borderRadius:    BORDER_RADIUS.xl,
    borderWidth:     1,
    borderColor:     alpha(COLORS.secondaryLegacy, 0.3),
    padding:         SPACING.lg,
    ...SHADOWS.primary,
  },
  fullTitle: {
    color:          COLORS.secondary,
    fontSize:       FONT_SIZE.sm,
    fontWeight:     FONT_WEIGHT.semibold,
    textAlign:      'center',
    marginBottom:   SPACING.md,
    letterSpacing:  1,
    textTransform:  'uppercase',
  },
  fullRow: {
    flexDirection:  'row',
    justifyContent: 'space-around',
    alignItems:     'center',
  },
  fullItem: {
    alignItems: 'center',
    gap:        SPACING.xs,
    flex:       1,
  },
  divider: {
    width:           1,
    height:          60,
    backgroundColor: alpha(COLORS.secondaryLegacy, 0.3),
  },
  fullAmount: {
    color:      COLORS.surface,
    fontSize:   FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.extrabold,
  },
  fullLabel: {
    color:      COLORS.textSecondary,
    fontSize:   FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  premiumAmount: {
    color: COLORS.premium,
  },
  premiumLabel: {
    color: COLORS.premium,
  },

  // Fragmentos
  fragmentsRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      SPACING.md,
    paddingTop:     SPACING.md,
    borderTopWidth: 1,
    borderTopColor: alpha(COLORS.secondaryLegacy, 0.2),
    gap:            SPACING.xs,
  },
  fragmentsText: {
    color:      COLORS.secondary,
    fontSize:   FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  fragmentsNote: {
    color:    COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
  },

  // Placeholders de ícone (remover quando assets chegarem)
  crystalIconPlaceholder: {
    width:           20,
    height:          20,
    borderRadius:    4,
    backgroundColor: COLORS.primary,
    opacity:         0.8,
  },
  iconLg: {
    width:  40,
    height: 40,
  },
  iconPremium: {
    backgroundColor: COLORS.premium,
  },
  fragmentIconPlaceholder: {
    width:           12,
    height:          12,
    borderRadius:    2,
    backgroundColor: COLORS.secondary,
    opacity:         0.7,
  },
});
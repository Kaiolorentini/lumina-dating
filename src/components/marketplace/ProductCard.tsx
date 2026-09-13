// ============================================
// LUMINA — PRODUCT CARD v2.0
// src/components/marketplace/ProductCard.tsx
//
// Vitrine luminosa: a capa domina o card, o conteúdo textual
// vive sobre uma superfície elevada, e o dourado aparece só
// onde carrega valor (preço) ou estado (favorito ativo).
//
// v2.0 — apenas visual. Props, callbacks e regras inalterados.
// ============================================

import React, { memo } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
} from 'react-native';
import { colors, fonts, spacing, borderRadius, shadows } from '../../theme';
import { Product } from '../../shared/types/marketplace';

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  onFavorite?: () => void;
  isFavorited?: boolean;
  compact?: boolean;
}

export const ProductCard = memo(function ProductCard({
  product, onPress, onFavorite, isFavorited, compact,
}: ProductCardProps) {
  const isFree = product.isFree;

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.coverWrap}>
        <Image
          source={{ uri: product.coverImage || 'https://via.placeholder.com/300' }}
          style={[styles.cover, compact && styles.coverCompact]}
          resizeMode="cover"
        />

        {onFavorite && (
          <TouchableOpacity
            style={[styles.favoriteBtn, isFavorited && styles.favoriteBtnActive]}
            onPress={onFavorite}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.favoriteIcon}>{isFavorited ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        )}

        {isFree && (
          <View style={styles.freeTag}>
            <Text style={styles.freeTagText}>GRÁTIS</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.categoryRow}>
          <View style={styles.categoryDot} />
          <Text style={styles.category} numberOfLines={1}>
            {product.category}
          </Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>{product.title}</Text>

        <View style={styles.footer}>
          <View>
            {!isFree && <Text style={styles.priceLabel}>A partir de</Text>}
            <Text style={[styles.price, isFree && styles.priceFree]}>
              {isFree ? 'Grátis' : `R$ ${product.price.toFixed(2).replace('.', ',')}`}
            </Text>
          </View>
          {product.averageRating > 0 && (
            <View style={styles.ratingPill}>
              <Text style={styles.ratingText}>★ {product.averageRating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    overflow: 'hidden',
    width: '100%',
    ...shadows.lifted,
  },
  cardCompact: {
    width: 168,
    marginRight: spacing.sm,
  },

  coverWrap: { position: 'relative' },
  cover: {
    width: '100%',
    height: 190,
    backgroundColor: colors.surfaceSunken,
  },
  coverCompact: { height: 128 },

  favoriteBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBtnActive: {
    borderColor: colors.goldBorder,
    backgroundColor: colors.goldSubtle,
  },
  favoriteIcon: { fontSize: 15 },

  freeTag: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.success,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  freeTagText: {
    color: colors.background,
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.heavy,
    letterSpacing: fonts.tracking.wider,
  },

  info: {
    padding: spacing.md,
    gap: 6,
    backgroundColor: colors.surfaceRaised,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryDot: {
    width: 5,
    height: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gold,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    letterSpacing: fonts.tracking.tight,
    lineHeight: 21,
  },
  category: {
    color: colors.textMuted,
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: fonts.tracking.wider,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.goldSubtle,
  },
  priceLabel: {
    color: colors.textMuted,
    fontSize: fonts.sizes.xs,
    letterSpacing: fonts.tracking.wide,
  },
  price: {
    color: colors.gold,
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.heavy,
    letterSpacing: fonts.tracking.tight,
  },
  priceFree: { color: colors.success },

  ratingPill: {
    backgroundColor: colors.goldSubtle,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  ratingText: {
    color: colors.goldLight,
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
  },
});
// ============================================
// LUMINA — PRODUCT CARD v3.0
// src/components/marketplace/ProductCard.tsx
//
// v3.0 — identidade do marketplace: base roxa em gradiente,
// dourado reservado para preço e destaque. O card anterior
// usava o tema clássico e ficava indistinguível das telas
// administrativas.
//
// Props, callbacks e regras inalterados desde a v1.
// ============================================

import React, { memo } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MP, MP_GRADIENT, MP_SHADOW, MP_FONT, MP_CATEGORY,
  spacing, borderRadius,
} from '../../theme/marketplace';
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
  const isFree = product.isFree || product.price === 0;
  const cat = MP_CATEGORY[product.category as keyof typeof MP_CATEGORY];

  return (
    <TouchableOpacity
      style={[
        styles.shell,
        compact && styles.shellCompact,
        product.isFeatured && styles.shellFeatured,
      ]}
      onPress={onPress}
      activeOpacity={0.92}
    >
      <LinearGradient
        colors={product.isFeatured ? MP_GRADIENT.featured : MP_GRADIENT.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.coverWrap}>
          <Image
            source={{ uri: product.coverImage || 'https://via.placeholder.com/400' }}
            style={[styles.cover, compact && styles.coverCompact]}
            resizeMode="cover"
          />

          {/* Gradiente do topo: dá contraste aos badges sem
              escurecer o meio da imagem, como o véu antigo fazia. */}
          <LinearGradient
            colors={['rgba(11, 7, 22, 0.7)', 'transparent']}
            style={styles.coverTopFade}
            pointerEvents="none"
          />

          {product.isFeatured && (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredBadgeText}>✦ DESTAQUE</Text>
            </View>
          )}

          {isFree && !product.isFeatured && (
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>GRÁTIS</Text>
            </View>
          )}

          {onFavorite && (
            <TouchableOpacity
              style={[styles.favBtn, isFavorited && styles.favBtnActive]}
              onPress={onFavorite}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.favIcon}>{isFavorited ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.catRow}>
            <Text style={styles.catIcon}>{cat?.icon ?? '✧'}</Text>
            <Text style={styles.catLabel} numberOfLines={1}>
              {cat?.label ?? product.category}
            </Text>
            {product.averageRating > 0 && (
              <>
                <View style={styles.catDivider} />
                <Text style={styles.rating}>★ {product.averageRating.toFixed(1)}</Text>
              </>
            )}
          </View>

          <Text style={styles.title} numberOfLines={2}>{product.title}</Text>

          <View style={styles.priceRow}>
            {isFree ? (
              <Text style={styles.priceFree}>Grátis</Text>
            ) : (
              <View style={styles.priceGroup}>
                <Text style={styles.priceCurrency}>R$</Text>
                <Text style={styles.priceValue}>
                  {product.price.toFixed(2).replace('.', ',')}
                </Text>
              </View>
            )}
            <View style={styles.cta}>
              <Text style={styles.ctaText}>Ver</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  // Shell existe separado do gradiente: sombra não funciona em
  // View com overflow hidden, então a elevação fica fora e o
  // recorte dentro.
  shell: {
    width: '100%',
    borderRadius: borderRadius.lg,
    ...MP_SHADOW.card,
  },
  shellCompact: { width: 172, marginRight: spacing.md },
  shellFeatured: { ...MP_SHADOW.purpleGlow },

  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: MP.border,
    overflow: 'hidden',
  },

  coverWrap: { position: 'relative' },
  cover: {
    width: '100%',
    height: 176,
    backgroundColor: MP.bgElevated,
  },
  coverCompact: { height: 124 },
  coverTopFade: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 56,
  },

  featuredBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: MP.gold,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  featuredBadgeText: {
    color: MP.textOnGold,
    fontSize: MP_FONT.size.xs,
    fontWeight: MP_FONT.weight.heavy,
    letterSpacing: MP_FONT.tracking.wider,
  },

  freeBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: MP.free,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  freeBadgeText: {
    color: MP.textOnGold,
    fontSize: MP_FONT.size.xs,
    fontWeight: MP_FONT.weight.heavy,
    letterSpacing: MP_FONT.tracking.wider,
  },

  favBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(11, 7, 22, 0.72)',
    borderWidth: 1,
    borderColor: MP.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBtnActive: {
    backgroundColor: MP.purpleSubtle,
    borderColor: MP.purpleLight,
  },
  favIcon: { fontSize: 15 },

  body: { padding: spacing.md, gap: 7 },

  catRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  catIcon: { fontSize: 11 },
  catLabel: {
    color: MP.purpleLight,
    fontSize: MP_FONT.size.xs,
    fontWeight: MP_FONT.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: MP_FONT.tracking.wide,
  },
  catDivider: {
    width: 3, height: 3,
    borderRadius: borderRadius.full,
    backgroundColor: MP.textMuted,
    marginHorizontal: 2,
  },
  rating: {
    color: MP.goldLight,
    fontSize: MP_FONT.size.xs,
    fontWeight: MP_FONT.weight.bold,
  },

  title: {
    color: MP.text,
    fontSize: MP_FONT.size.lg,
    fontWeight: MP_FONT.weight.bold,
    letterSpacing: MP_FONT.tracking.tight,
    lineHeight: 20,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: MP.border,
  },
  priceGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  priceCurrency: {
    color: MP.gold,
    fontSize: MP_FONT.size.sm,
    fontWeight: MP_FONT.weight.semibold,
  },
  priceValue: {
    color: MP.gold,
    fontSize: MP_FONT.size.xl,
    fontWeight: MP_FONT.weight.heavy,
    letterSpacing: MP_FONT.tracking.tight,
  },
  priceFree: {
    color: MP.free,
    fontSize: MP_FONT.size.xl,
    fontWeight: MP_FONT.weight.heavy,
  },

  cta: {
    backgroundColor: MP.goldSubtle,
    borderWidth: 1,
    borderColor: MP.borderGold,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  ctaText: {
    color: MP.goldLight,
    fontSize: MP_FONT.size.sm,
    fontWeight: MP_FONT.weight.bold,
  },
});
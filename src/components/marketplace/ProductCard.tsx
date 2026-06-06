import React, { memo } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
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
  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri: product.coverImage || 'https://via.placeholder.com/300' }}
        style={[styles.cover, compact && styles.coverCompact]}
        resizeMode="cover"
      />
      {onFavorite && (
        <TouchableOpacity style={styles.favoriteBtn} onPress={onFavorite}>
          <Text style={styles.favoriteIcon}>{isFavorited ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{product.title}</Text>
        <View style={styles.row}>
          <Text style={styles.price}>
            {product.isFree ? 'Grátis' : `R$ ${product.price.toFixed(2)}`}
          </Text>
          {product.averageRating > 0 && (
            <Text style={styles.rating}>⭐ {product.averageRating.toFixed(1)}</Text>
          )}
        </View>
        <Text style={styles.category}>{product.category}</Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  cardCompact: {
    width: 160,
    marginRight: spacing.sm,
    marginBottom: 0,
  },
  cover: {
    width: '100%',
    height: 180,
  },
  coverCompact: {
    height: 120,
  },
  favoriteBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.background + 'CC',
    borderRadius: borderRadius.full,
    padding: spacing.xs,
  },
  favoriteIcon: { fontSize: 18 },
  info: { padding: spacing.md },
  title: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  price: {
    color: colors.gold,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
  },
  rating: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
  },
  category: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    textTransform: 'capitalize',
  },
});
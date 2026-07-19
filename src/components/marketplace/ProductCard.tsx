import React, { memo } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';
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
        <Text style={styles.title} numberOfLines={3}>{product.title}</Text>
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
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    width: '100%',
  },
  cardCompact: {
    width: 160,
    marginRight: SPACING.sm,
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
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.background + 'CC',
    borderRadius: BORDER_RADIUS.full,
    padding: SPACING.xs,
  },
  favoriteIcon: { fontSize: FONT_SIZE.xl },
  info: { padding: SPACING.md },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  price: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.bold,
  },
  rating: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.caption,
  },
  category: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.caption,
    textTransform: 'capitalize',
  },
});
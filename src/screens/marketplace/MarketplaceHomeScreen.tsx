import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useProducts } from '../../hooks/useProducts';
import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../context/AuthContext';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function MarketplaceHomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const filters = useMemo(() => ({
    status: 'approved' as const,
  }), []);

  const { products, loading, loadingMore, hasMore, loadMore, refresh } = useProducts(filters);
  const { favoriteIds, toggleFavorite } = useFavorites(user?.uid);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    return products.filter(p =>
      p.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) loadMore();
  }, [loadingMore, hasMore, loadMore]);

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Marketplace</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Busca */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar produtos..."
          placeholderTextColor={colors.gray}
        />
      </View>

      {/* Produtos */}
      {loading ? (
        <View style={styles.skeletonContainer}>
          {[0, 1].map(row => (
            <View key={row} style={styles.skeletonRow}>
              {[0, 1].map(col => (
                <View key={col} style={styles.skeletonCard}>
                  <View style={styles.skeletonImage} />
                  <View style={styles.skeletonInfo}>
                    <View style={styles.skeletonLineWide} />
                    <View style={styles.skeletonLineShort} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refresh}
              tintColor={colors.gold}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <MarketplaceEmptyState
              icon="🛍️"
              title="Nenhum produto encontrado"
              subtitle="Tente outra categoria ou busca"
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.gold} style={{ margin: spacing.md }} />
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ProductCard
                product={item}
                onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
                onFavorite={() => toggleFavorite(item.id)}
                isFavorited={favoriteIds.includes(item.id)}
              />
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const CARD_GAP = spacing.sm;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
  },
  searchContainer: { padding: spacing.md },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
    color: colors.white,
    padding: spacing.md,
    fontSize: fonts.sizes.md,
  },
  listContent: { padding: spacing.md, paddingTop: spacing.sm, rowGap: CARD_GAP },
  columnWrapper: { gap: CARD_GAP },
  cardWrapper: { flex: 1 },
  skeletonContainer: { padding: spacing.md, paddingTop: spacing.sm, gap: CARD_GAP },
  skeletonRow: { flexDirection: 'row', gap: CARD_GAP },
  skeletonCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
    overflow: 'hidden',
  },
  skeletonImage: {
    width: '100%',
    height: 140,
    backgroundColor: colors.grayDark + '44',
  },
  skeletonInfo: { padding: spacing.md, gap: spacing.sm },
  skeletonLineWide: {
    height: 14,
    backgroundColor: colors.grayDark + '44',
    borderRadius: borderRadius.sm,
    width: '80%',
  },
  skeletonLineShort: {
    height: 14,
    backgroundColor: colors.grayDark + '44',
    borderRadius: borderRadius.sm,
    width: '50%',
  },
});
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Button, Input } from '../../components/ui';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha} from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useProducts } from '../../hooks/useProducts';
import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../context/AuthContext';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import ScreenContainer from '../../components/ScreenContainer';
import { SkeletonLine } from '../../components/ui/Skeleton';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function MarketplaceHomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const filters = useMemo(() => ({ status: 'approved' as const }), []);
  const { products, loading, loadingMore, hasMore, loadMore, refresh } = useProducts(filters);
  const { favoriteIds, toggleFavorite } = useFavorites(user?.uid);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    return products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) loadMore();
  }, [loadingMore, hasMore, loadMore]);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Marketplace</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchContainer}>
        <Input value={search} onChangeText={setSearch} placeholder="Buscar produtos..." />
      </View>

      {loading ? (
        <View style={styles.skeletonContainer}>
          {[0, 1].map(row => (
            <View key={row} style={styles.skeletonRow}>
              {[0, 1].map(col => (
                <View key={col} style={styles.skeletonCard}>
                  <View style={styles.skeletonImage} />
                  <View style={{ padding: SPACING.md, gap: SPACING.sm }}>
                    <SkeletonLine width="80%" />
                    <SkeletonLine width="50%" />
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
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={COLORS.gold} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <MarketplaceEmptyState icon="🛍️" title="Nenhum produto encontrado" subtitle="Tente outra categoria ou busca" />
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.gold} style={{ margin: SPACING.md }} /> : null}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ProductCard product={item} onPress={() => navigation.navigate('ProductDetail', { productId: item.id })} onFavorite={() => toggleFavorite(item.id)} isFavorited={favoriteIds.includes(item.id)} />
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const CARD_GAP = SPACING.sm;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: alpha(COLORS.gold, 0.27) },
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  searchContainer: { padding: SPACING.md },
  // backBtn/searchInput removed — now uses Button/Input
  listContent: { padding: SPACING.md, paddingTop: SPACING.sm, rowGap: CARD_GAP },
  columnWrapper: { gap: CARD_GAP },
  cardWrapper: { flex: 1 },
  skeletonContainer: { padding: SPACING.md, paddingTop: SPACING.sm, gap: CARD_GAP },
  skeletonRow: { flexDirection: 'row', gap: CARD_GAP },
  skeletonCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  skeletonImage: { width: '100%', height: 140, backgroundColor: alpha(COLORS.card, 0.53) },
});

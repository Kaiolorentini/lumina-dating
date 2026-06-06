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
import { ProductCategory } from '../../shared/types/marketplace';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES: { label: string; value: ProductCategory | 'todos' }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Fotos', value: 'fotos' },
  { label: 'Vídeos', value: 'videos' },
  { label: 'Cursos', value: 'cursos' },
  { label: 'PDFs', value: 'pdfs' },
  { label: 'Outros', value: 'outros' },
];

export default function MarketplaceHomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'todos'>('todos');

  const filters = useMemo(() => ({
    status: 'approved' as const,
    category: selectedCategory === 'todos' ? undefined : selectedCategory,
  }), [selectedCategory]);

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
    <View style={styles.container}>
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

      {/* Categorias */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={item => item.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategory === item.value && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(item.value)}
          >
            <Text style={[
              styles.categoryText,
              selectedCategory === item.value && styles.categoryTextActive,
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Produtos */}
      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
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
            <ProductCard
              product={item}
              onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
              onFavorite={() => toggleFavorite(item.id)}
              isFavorited={favoriteIds.includes(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
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
  categoriesContainer: { paddingHorizontal: spacing.md, gap: spacing.sm },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.grayDark,
    marginRight: spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  categoryText: { color: colors.gray, fontSize: fonts.sizes.sm },
  categoryTextActive: { color: colors.background, fontWeight: 'bold' },
  listContent: { padding: spacing.md },
});
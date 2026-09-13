// ============================================
// LUMINA — MARKETPLACE HOME v2.0
// src/screens/marketplace/MarketplaceHomeScreen.tsx
//
// v2.0 — reestruturação visual. Nenhuma regra de negócio mudou:
// mesma paginação, mesmos filtros, mesmo hook de favoritos.
//
// A tela era header + busca + grade. Agora tem a arquitetura de
// uma vitrine: destaques em carrossel (isFeatured, curado pelo
// admin), navegação por categoria e a grade completa abaixo.
//
// O carrossel usa um segundo useProducts com isFeatured: true —
// consulta separada e barata, some sozinha quando não há destaque.
// ============================================

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius, shadows } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useProducts } from '../../hooks/useProducts';
import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../context/AuthContext';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import ScreenContainer from '../../components/ScreenContainer';
import { ProductCategory } from '../../shared/types/marketplace';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type CategoryFilter = ProductCategory | 'all';

const CATEGORIES: { key: CategoryFilter; label: string; icon: string }[] = [
  { key: 'all',    label: 'Tudo',    icon: '✦' },
  { key: 'fotos',  label: 'Fotos',   icon: '📷' },
  { key: 'videos', label: 'Vídeos',  icon: '🎬' },
  { key: 'cursos', label: 'Cursos',  icon: '🎓' },
  { key: 'pdfs',   label: 'PDFs',    icon: '📄' },
  { key: 'outros', label: 'Outros',  icon: '✧' },
];

export default function MarketplaceHomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const filters = useMemo(() => ({
    status: 'approved' as const,
    ...(category !== 'all' && { category }),
  }), [category]);

  // Consulta separada — o carrossel de destaques não deve competir
  // com a paginação da grade nem herdar o filtro de categoria.
  const featuredFilters = useMemo(() => ({
    status: 'approved' as const,
    isFeatured: true,
    pageSize: 8,
  }), []);

  const { products, loading, loadingMore, hasMore, loadMore, refresh } = useProducts(filters);
  const { products: featured } = useProducts(featuredFilters);
  const { favoriteIds, toggleFavorite } = useFavorites(user?.uid);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p => p.title.toLowerCase().includes(q));
  }, [products, search]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) loadMore();
  }, [loadingMore, hasMore, loadMore]);

  // Busca ativa esconde destaques e categorias: quem está procurando
  // algo específico não quer navegar por vitrine.
  const isSearching = search.trim().length > 0;

  function renderHeader() {
    return (
      <View>
        {!isSearching && featured.length > 0 && (
          <View style={styles.featuredSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Em destaque</Text>
              <View style={styles.sectionRule} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredList}
            >
              {featured.map(item => (
                <ProductCard
                  key={item.id}
                  product={item}
                  compact
                  onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
                  onFavorite={() => toggleFavorite(item.id)}
                  isFavorited={favoriteIds.includes(item.id)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {!isSearching && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {category === 'all'
                ? 'Todos os produtos'
                : CATEGORIES.find(c => c.key === category)?.label}
            </Text>
            <View style={styles.sectionRule} />
          </View>
        )}
      </View>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Marketplace</Text>
          <Text style={styles.headerSubtitle}>Conteúdo de criadores</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('MyFavorites')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.headerAction}>♥</Text>
        </TouchableOpacity>
      </View>

      {/* Busca */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar produtos"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Categorias */}
      {!isSearching && (
        <View style={styles.categoryBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          >
            {CATEGORIES.map(cat => {
              const active = category === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => setCategory(cat.key)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Produtos */}
      {loading ? (
        <View style={styles.skeletonContainer}>
          {[0, 1].map(row => (
            <View key={row} style={styles.skeletonRow}>
              {[0, 1].map(col => (
                <View key={col} style={styles.skeletonCard}>
                  <View style={styles.skeletonImage} />
                  <View style={styles.skeletonInfo}>
                    <View style={styles.skeletonLineShort} />
                    <View style={styles.skeletonLineWide} />
                    <View style={styles.skeletonLinePrice} />
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
          ListHeaderComponent={renderHeader}
          showsVerticalScrollIndicator={false}
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
              subtitle={isSearching ? 'Tente outro termo de busca' : 'Tente outra categoria'}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.gold} style={{ margin: spacing.lg }} />
            ) : <View style={{ height: spacing.lg }} />
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

const CARD_GAP = spacing.md;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  backBtn: { color: colors.gold, fontSize: 30, width: 32 },
  headerCenter: { alignItems: 'center' },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
    letterSpacing: fonts.tracking.tight,
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: fonts.sizes.xs,
    letterSpacing: fonts.tracking.wide,
    marginTop: 1,
  },
  headerAction: { color: colors.gold, fontSize: 22, width: 32, textAlign: 'right' },

  searchContainer: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.grayDark,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  searchIcon: { color: colors.textMuted, fontSize: 18 },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fonts.sizes.md,
    padding: 0,
  },
  searchClear: { color: colors.textMuted, fontSize: 15 },

  categoryBar: { paddingBottom: spacing.sm },
  categoryList: { paddingHorizontal: spacing.md, gap: spacing.sm },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.grayDark,
    backgroundColor: colors.surface,
  },
  categoryChipActive: {
    borderColor: colors.gold,
    backgroundColor: colors.goldSubtle,
    ...shadows.glow,
  },
  categoryIcon: { fontSize: 13 },
  categoryLabel: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
  },
  categoryLabelActive: {
    color: colors.gold,
    fontWeight: fonts.weights.bold,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    letterSpacing: fonts.tracking.tight,
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.goldSubtle,
  },

  featuredSection: { marginBottom: spacing.lg },
  featuredList: { paddingRight: spacing.md, paddingBottom: spacing.sm },

  listContent: { padding: spacing.md, paddingTop: spacing.xs, rowGap: CARD_GAP },
  columnWrapper: { gap: CARD_GAP },
  cardWrapper: { flex: 1 },

  skeletonContainer: { padding: spacing.md, gap: CARD_GAP },
  skeletonRow: { flexDirection: 'row', gap: CARD_GAP },
  skeletonCard: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.grayDark,
    overflow: 'hidden',
  },
  skeletonImage: {
    width: '100%',
    height: 190,
    backgroundColor: colors.surfaceSunken,
  },
  skeletonInfo: { padding: spacing.md, gap: spacing.sm },
  skeletonLineShort: {
    height: 9,
    backgroundColor: colors.surfaceSunken,
    borderRadius: borderRadius.xs,
    width: '35%',
  },
  skeletonLineWide: {
    height: 14,
    backgroundColor: colors.surfaceSunken,
    borderRadius: borderRadius.xs,
    width: '85%',
  },
  skeletonLinePrice: {
    height: 18,
    backgroundColor: colors.surfaceSunken,
    borderRadius: borderRadius.xs,
    width: '55%',
    marginTop: spacing.xs,
  },
});
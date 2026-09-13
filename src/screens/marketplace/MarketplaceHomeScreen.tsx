// ============================================
// LUMINA — MARKETPLACE HOME v3.0
// src/screens/marketplace/MarketplaceHomeScreen.tsx
//
// v3.0 — identidade visual própria: fundo em gradiente preto→
// dourado envolvendo o conteúdo, cards roxos por cima.
//
// O gradiente vive AQUI, não no ScreenContainer: aquele é usado
// por toda tela do app e mudar o fundo lá afetaria Home, Perfil
// e Chat. Aqui o escopo é só o marketplace.
//
// Nenhuma regra de negócio mudou desde a v1.
// ============================================

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  MP, MP_GRADIENT, MP_SHADOW, MP_FONT, MP_CATEGORY,
  spacing, borderRadius,
} from '../../theme/marketplace';
import { RootStackParamList } from '../../navigation/types';
import { useProducts } from '../../hooks/useProducts';
import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../context/AuthContext';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { FeaturedCarousel } from '../../components/marketplace/FeaturedCarousel';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import ScreenContainer from '../../components/ScreenContainer';
import { ProductCategory } from '../../shared/types/marketplace';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type CategoryFilter = ProductCategory | 'all';

const CATEGORY_KEYS = Object.keys(MP_CATEGORY) as ProductCategory[];

export default function MarketplaceHomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const filters = useMemo(() => ({
    status: 'approved' as const,
    ...(category !== 'all' && { category }),
  }), [category]);

  const featuredFilters = useMemo(() => ({
    status: 'approved' as const,
    isFeatured: true,
    pageSize: 8,
  }), []);

  const { products, loading, loadingMore, hasMore, loadMore, refresh } = useProducts(filters);
  const { products: featured, refresh: refreshFeatured } = useProducts(featuredFilters);
  const { favoriteIds, toggleFavorite } = useFavorites(user?.uid);
  // isCreator já cobre creator, admin e superadmin, e é falso para
  // conta bloqueada — mesma regra do isCreator() nas firestore.rules.
  const { isCreator } = useUserPermissions(user?.uid);

  // O Marketplace é uma aba: fica montado o tempo todo. Sem isto,
  // um produto destacado pelo admin só entrava no carrossel depois
  // de fechar e reabrir o app — os filtros do hook são fixos, então
  // o useEffect interno nunca dispara de novo.
  useFocusEffect(
    useCallback(() => { refreshFeatured(); }, [refreshFeatured]),
  );

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p => p.title.toLowerCase().includes(q));
  }, [products, search]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) loadMore();
  }, [loadingMore, hasMore, loadMore]);

  const isSearching = search.trim().length > 0;

  function renderHeader() {
    return (
      <View>
        {!isSearching && featured.length > 0 && (
          <View style={styles.featuredSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>✦</Text>
              <Text style={styles.sectionTitle}>Em destaque</Text>
              <View style={styles.sectionRule} />
            </View>
            <FeaturedCarousel
              products={featured}
              onPressProduct={id => navigation.navigate('ProductDetail', { productId: id })}
            />
          </View>
        )}

        {!isSearching && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>
              {category === 'all' ? '◈' : MP_CATEGORY[category as ProductCategory]?.icon}
            </Text>
            <Text style={styles.sectionTitle}>
              {category === 'all'
                ? 'Todos os produtos'
                : MP_CATEGORY[category as ProductCategory]?.label}
            </Text>
            <View style={styles.sectionRule} />
            <Text style={styles.sectionCount}>{filteredProducts.length}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <ScreenContainer>
      {/* Gradiente de fundo — absoluto para cobrir toda a área sem
          interferir no layout dos filhos. */}
      <LinearGradient
        colors={MP_GRADIENT.screen}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
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

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar produtos"
            placeholderTextColor={MP.textMuted}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!isSearching && (
        <View style={styles.categoryBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          >
            <TouchableOpacity
              style={[styles.chip, category === 'all' && styles.chipActive]}
              onPress={() => setCategory('all')}
              activeOpacity={0.8}
            >
              <Text style={styles.chipIcon}>◈</Text>
              <Text style={[styles.chipLabel, category === 'all' && styles.chipLabelActive]}>
                Tudo
              </Text>
            </TouchableOpacity>

            {CATEGORY_KEYS.map(key => {
              const active = category === key;
              const cat = MP_CATEGORY[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCategory(key)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chipIcon}>{cat.icon}</Text>
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

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
          // renderHeader() e não renderHeader: passar a referência da
          // função fazia o FlatList reaproveitar o header da primeira
          // renderização, quando featured ainda estava vazio — o
          // carrossel nunca aparecia mesmo com os dados chegando.
          ListHeaderComponent={renderHeader()}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} tintColor={MP.gold} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          // O FlatList não dá altura ao contentContainer, então o
          // flex:1 do empty state não centraliza — sem minHeight ele
          // gruda embaixo da busca com um vazio enorme abaixo.
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MarketplaceEmptyState
                icon="🛍️"
                title="Nenhum produto encontrado"
                subtitle={isSearching ? 'Tente outro termo de busca' : 'Tente outra categoria'}
              />
            </View>
          }
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={MP.gold} style={{ margin: spacing.lg }} />
              : <View style={{ height: spacing.xl }} />
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

      {/* FAB de publicação — position absolute de propósito: quando
          o usuário não é criador o botão simplesmente não existe e
          nada no layout se desloca. Um botão inline deixaria vão. */}
      {isCreator && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateProduct')}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={MP_GRADIENT.gold}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabInner}
          >
            <Text style={styles.fabIcon}>+</Text>
            <Text style={styles.fabText}>Publicar</Text>
          </LinearGradient>
        </TouchableOpacity>
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
  backBtn: { color: MP.gold, fontSize: 30, width: 32 },
  headerCenter: { alignItems: 'center' },
  headerTitle: {
    color: MP.text,
    fontSize: MP_FONT.size.xxl,
    fontWeight: MP_FONT.weight.heavy,
    letterSpacing: MP_FONT.tracking.tight,
  },
  headerSubtitle: {
    color: MP.purpleLight,
    fontSize: MP_FONT.size.xs,
    letterSpacing: MP_FONT.tracking.wide,
    marginTop: 1,
  },
  headerAction: { color: MP.gold, fontSize: 22, width: 32, textAlign: 'right' },

  searchContainer: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: MP.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: MP.border,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchIcon: { color: MP.textMuted, fontSize: 19 },
  searchInput: {
    flex: 1,
    color: MP.text,
    fontSize: MP_FONT.size.md,
    padding: 0,
  },
  searchClear: { color: MP.textMuted, fontSize: 15 },

  categoryBar: { paddingBottom: spacing.md },
  categoryList: { paddingHorizontal: spacing.md, gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: MP.border,
    backgroundColor: MP.surface,
  },
  chipActive: {
    borderColor: MP.purpleLight,
    backgroundColor: MP.purpleSubtle,
    ...MP_SHADOW.purpleGlow,
  },
  chipIcon: { fontSize: 13 },
  chipLabel: {
    color: MP.textSoft,
    fontSize: MP_FONT.size.md,
    fontWeight: MP_FONT.weight.medium,
  },
  chipLabelActive: {
    color: MP.purpleLight,
    fontWeight: MP_FONT.weight.bold,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionIcon: { color: MP.gold, fontSize: 14 },
  sectionTitle: {
    color: MP.text,
    fontSize: MP_FONT.size.lg,
    fontWeight: MP_FONT.weight.bold,
    letterSpacing: MP_FONT.tracking.tight,
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: MP.border,
    marginLeft: spacing.xs,
  },
  sectionCount: {
    color: MP.textMuted,
    fontSize: MP_FONT.size.sm,
    fontWeight: MP_FONT.weight.semibold,
  },

  // O FeaturedCarousel já traz marginBottom no container — sem
  // isto seriam 48px de vão até a seção seguinte.
  featuredSection: {},

  // paddingBottom generoso: o FAB flutua sobre a lista e cobriria
  // o último card sem esse respiro.
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 96,
    rowGap: CARD_GAP,
  },

  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    borderRadius: borderRadius.full,
    ...MP_SHADOW.goldGlow,
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    borderRadius: borderRadius.full,
  },
  fabIcon: {
    color: MP.textOnGold,
    fontSize: 20,
    fontWeight: MP_FONT.weight.heavy,
    marginTop: -2,
  },
  fabText: {
    color: MP.textOnGold,
    fontSize: MP_FONT.size.md,
    fontWeight: MP_FONT.weight.heavy,
  },
  columnWrapper: { gap: CARD_GAP },
  cardWrapper: { flex: 1 },
  emptyWrap: { minHeight: 380, justifyContent: 'center' },

  skeletonContainer: { padding: spacing.md, gap: CARD_GAP },
  skeletonRow: { flexDirection: 'row', gap: CARD_GAP },
  skeletonCard: {
    flex: 1,
    backgroundColor: MP.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: MP.border,
    overflow: 'hidden',
  },
  skeletonImage: { width: '100%', height: 176, backgroundColor: MP.bgElevated },
  skeletonInfo: { padding: spacing.md, gap: spacing.sm },
  skeletonLineShort: {
    height: 9, width: '35%',
    backgroundColor: MP.bgElevated,
    borderRadius: borderRadius.xs,
  },
  skeletonLineWide: {
    height: 14, width: '85%',
    backgroundColor: MP.bgElevated,
    borderRadius: borderRadius.xs,
  },
  skeletonLinePrice: {
    height: 18, width: '55%',
    backgroundColor: MP.bgElevated,
    borderRadius: borderRadius.xs,
    marginTop: spacing.xs,
  },
});
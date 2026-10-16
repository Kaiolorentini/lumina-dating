// ============================================
// LUMINA — MARKETPLACE NO COMPUTADOR
// src/components/marketplace/MarketplaceDesktop.tsx
//
// Só no computador (MarketplaceHomeScreen escolhe pela useBreakpoint;
// no app nunca aparece). Layout aprovado no protótipo:
//   • topo: título, busca larga, Favoritos e "+ Publicar" (criador);
//   • carrossel de destaques (FeaturedHeroDesktop, desde o D7);
//   • coluna de filtros: categorias, ordenar, "Seja criador";
//   • grade de 2 a 4 colunas com capas em 4:5 (sem esticar).
// Não lê nada: recebe os mesmos produtos que a tela já busca. Ordenar
// e buscar valem para a lista carregada (a tela diz isso).
// ============================================

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MP, MP_GRADIENT, MP_FONT, MP_CATEGORY, spacing, borderRadius,
} from '../../theme/marketplace';
import { Product, ProductCategory } from '../../shared/types/marketplace';
import { ProductCard } from './ProductCard';
import { MarketplaceEmptyState } from './MarketplaceEmptyState';
import HoverPressable from '../web/HoverPressable';
import FeaturedHeroDesktop from './FeaturedHeroDesktop';

type CategoryFilter = ProductCategory | 'all';
type SortKey = 'recent' | 'priceAsc' | 'priceDesc';

const CATEGORY_KEYS = Object.keys(MP_CATEGORY) as ProductCategory[];
const GRID_GAP = 16;
const SKELETONS = 8;
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent',    label: 'Mais recentes' },
  { key: 'priceAsc',  label: 'Menor preço' },
  { key: 'priceDesc', label: 'Maior preço' },
];

interface Props {
  featured:     Product[];
  products:     Product[];
  loading:      boolean;
  loadingMore:  boolean;
  hasMore:      boolean;
  error:        string | null;
  search:       string;
  onSearch:     (text: string) => void;
  category:     CategoryFilter;
  onCategory:   (c: CategoryFilter) => void;
  favoriteIds:  string[];
  isCreator:    boolean;
  onOpenProduct:    (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onLoadMore:   () => void;
  onRetry:      () => void;
  onPublish:    () => void;
  onFavorites:  () => void;
  onBecomeCreator: () => void;
  onMyProducts: () => void;
}

function priceOf(p: Product): number {
  return p.isFree ? 0 : p.price ?? 0;
}

function columnsFor(width: number): number {
  if (width >= 1000) return 4;
  if (width >= 720)  return 3;
  return 2;
}

export default function MarketplaceDesktop(props: Props) {
  const {
    featured, products, loading, loadingMore, hasMore, error, search, onSearch,
    category, onCategory, favoriteIds, isCreator, onOpenProduct, onToggleFavorite,
    onLoadMore, onRetry, onPublish, onFavorites, onBecomeCreator, onMyProducts,
  } = props;

  const [sort, setSort] = useState<SortKey>('recent');
  const [gridWidth, setGridWidth] = useState(0);

  function handleGridLayout(event: LayoutChangeEvent) {
    const w = event.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - gridWidth) > 1) setGridWidth(w);
  }

  const columns   = columnsFor(gridWidth);
  const cardWidth = gridWidth > 0 ? Math.floor((gridWidth - GRID_GAP * (columns - 1)) / columns) : 0;
  const coverHeight = Math.round(cardWidth * 1.25);

  const sorted = useMemo(() => {
    if (sort === 'recent') return products;
    const copy = [...products];
    copy.sort((a, b) => (sort === 'priceAsc' ? priceOf(a) - priceOf(b) : priceOf(b) - priceOf(a)));
    return copy;
  }, [products, sort]);

  const isSearching = search.trim().length > 0;
  const title = isSearching
    ? `Resultados para "${search.trim()}"`
    : category === 'all' ? 'Todos os produtos' : MP_CATEGORY[category]?.label ?? 'Produtos';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={MP_GRADIENT.screen}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>

          {/* ── Topo ── */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.h1} accessibilityRole="header">Marketplace</Text>
              <Text style={styles.subtitle}>Conteúdo exclusivo de criadores verificados</Text>
            </View>
            <View style={styles.search}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={onSearch}
                placeholder="Buscar produtos"
                placeholderTextColor={MP.textMuted}
                returnKeyType="search"
                accessibilityLabel="Buscar produtos"
                nativeID="marketplace-search"
              />
              {search.length > 0 && (
                <HoverPressable onPress={() => onSearch('')} accessibilityRole="button" accessibilityLabel="Limpar busca" hoverStyle={styles.fade}>
                  <Text style={styles.searchClear}>✕</Text>
                </HoverPressable>
              )}
            </View>
            <HoverPressable onPress={onFavorites} accessibilityRole="button" style={styles.outlineBtn} hoverStyle={styles.outlineBtnHover}>
              <Text style={styles.outlineBtnText}>♥ Favoritos</Text>
            </HoverPressable>
            {isCreator && (
              <HoverPressable onPress={onPublish} accessibilityRole="button" style={styles.goldBtn} hoverStyle={styles.goldBtnHover}>
                <Text style={styles.goldBtnText}>+ Publicar</Text>
              </HoverPressable>
            )}
          </View>

          {/* ── Destaques (carrossel; D7 corrige os 2 cartões esticados) ── */}
          {!isSearching && featured.length > 0 && (
            <FeaturedHeroDesktop products={featured} onOpen={onOpenProduct} />
          )}

          <View style={styles.body}>
            {/* ── Filtros ── */}
            <View style={styles.filters} accessibilityLabel="Filtros">
              <Text style={styles.kicker}>Categoria</Text>
              {(['all', ...CATEGORY_KEYS] as CategoryFilter[]).map(key => {
                const active = category === key && !isSearching;
                const cat = key === 'all' ? null : MP_CATEGORY[key];
                return (
                  <HoverPressable
                    key={key}
                    onPress={() => { onSearch(''); onCategory(key); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.catItem, active && styles.catItemActive]}
                    hoverStyle={!active ? styles.catItemHover : undefined}
                  >
                    <Text style={[styles.catText, active && styles.catTextActive]}>
                      {cat ? `${cat.icon}  ${cat.label}` : '◈  Tudo'}
                    </Text>
                  </HoverPressable>
                );
              })}

              <Text style={[styles.kicker, styles.kickerSpaced]}>Ordenar</Text>
              {SORTS.map(s => {
                const active = sort === s.key;
                return (
                  <HoverPressable
                    key={s.key}
                    onPress={() => setSort(s.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    style={[styles.catItem, active && styles.sortActive]}
                    hoverStyle={!active ? styles.catItemHover : undefined}
                  >
                    <Text style={[styles.catText, active && styles.sortTextActive]}>{active ? '● ' : '○ '}{s.label}</Text>
                  </HoverPressable>
                );
              })}

              {isCreator ? (
                <HoverPressable onPress={onMyProducts} accessibilityRole="button" style={styles.creatorCard} hoverStyle={styles.creatorCardHover}>
                  <Text style={styles.creatorTitle}>Seus produtos</Text>
                  <Text style={styles.creatorText}>Edite, acompanhe a análise e veja o que já vendeu.</Text>
                  <Text style={styles.creatorLink}>Abrir meus produtos ›</Text>
                </HoverPressable>
              ) : (
                <HoverPressable onPress={onBecomeCreator} accessibilityRole="button" style={styles.creatorCard} hoverStyle={styles.creatorCardHover}>
                  <Text style={styles.creatorTitle}>Seja criador</Text>
                  <Text style={styles.creatorText}>Venda seu conteúdo para quem já está no Lumina.</Text>
                  <Text style={styles.creatorLink}>Saber mais ›</Text>
                </HoverPressable>
              )}
            </View>

            {/* ── Grade ── */}
            <View style={styles.main}>
              <View style={styles.mainHead}>
                <Text style={styles.mainTitle} numberOfLines={1}>{title}</Text>
                {!loading && !error && (
                  <Text style={styles.mainCount}>
                    {sorted.length === 1 ? '1 produto' : `${sorted.length} produtos`}
                    {hasMore && !isSearching ? ' carregados' : ''}
                  </Text>
                )}
              </View>
              {(isSearching || sort !== 'recent') && hasMore && (
                <Text style={styles.note}>Busca e ordem valem para os produtos já carregados. Use "Ver mais produtos" para incluir mais.</Text>
              )}

              <View style={styles.grid} onLayout={handleGridLayout}>
                {cardWidth === 0 ? null : loading ? (
                  Array.from({ length: SKELETONS }).map((_, i) => (
                    <View key={i} style={[styles.skeleton, { width: cardWidth }]}>
                      <View style={[styles.skeletonCover, { height: coverHeight }]} />
                      <View style={styles.skeletonLineWide} />
                      <View style={styles.skeletonLine} />
                    </View>
                  ))
                ) : error ? (
                  <View style={styles.stateBox}>
                    <Text style={styles.stateTitle}>Não foi possível carregar os produtos</Text>
                    <Text style={styles.stateText}>Verifique sua conexão e tente de novo.</Text>
                    <HoverPressable onPress={onRetry} accessibilityRole="button" style={styles.goldBtn} hoverStyle={styles.goldBtnHover}>
                      <Text style={styles.goldBtnText}>Tentar de novo</Text>
                    </HoverPressable>
                  </View>
                ) : sorted.length === 0 ? (
                  <View style={styles.stateBox}>
                    <MarketplaceEmptyState
                      icon="🛍️"
                      title="Nenhum produto encontrado"
                      subtitle={isSearching ? 'Tente outro termo de busca' : 'Tente outra categoria'}
                    />
                  </View>
                ) : (
                  sorted.map(item => (
                    <HoverPressable
                      key={item.id}
                      accessible={false}
                      focusable={false}
                      style={[styles.cardCell, { width: cardWidth }]}
                      hoverStyle={styles.cardCellHover}
                    >
                      <ProductCard
                        product={item}
                        onPress={() => onOpenProduct(item.id)}
                        onFavorite={() => onToggleFavorite(item.id)}
                        isFavorited={favoriteIds.includes(item.id)}
                        coverHeight={coverHeight}
                      />
                    </HoverPressable>
                  ))
                )}
              </View>

              {!loading && !error && hasMore && (
                <HoverPressable
                  onPress={onLoadMore}
                  disabled={loadingMore}
                  accessibilityRole="button"
                  style={styles.moreBtn}
                  hoverStyle={styles.outlineBtnHover}
                >
                  {loadingMore
                    ? <ActivityIndicator color={MP.gold} />
                    : <Text style={styles.moreText}>Ver mais produtos</Text>}
                </HoverPressable>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { flexGrow: 1 },
  page:      { width: '100%', maxWidth: 1320, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 28, paddingBottom: 48, gap: 26 },
  fade:      { opacity: 0.7 },

  header:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  headerText: { marginRight: 'auto', gap: 2 },
  h1:         { color: MP.text, fontSize: 28, fontWeight: MP_FONT.weight.heavy },
  subtitle:   { color: MP.purpleLight, fontSize: 13 },
  search: {
    width: 420, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, height: 46, borderRadius: 14,
    backgroundColor: MP.surface, borderWidth: 1, borderColor: MP.border,
  },
  searchIcon:  { color: MP.textMuted, fontSize: 18 },
  searchInput: { flex: 1, color: MP.text, fontSize: MP_FONT.size.md, padding: 0 },
  searchClear: { color: MP.textMuted, fontSize: 15 },
  outlineBtn:  { height: 46, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: MP.border, alignItems: 'center', justifyContent: 'center', backgroundColor: MP.surface },
  outlineBtnHover: { borderColor: MP.purpleLight },
  outlineBtnText:  { color: MP.text, fontWeight: MP_FONT.weight.bold, fontSize: MP_FONT.size.md },
  goldBtn:     { height: 46, paddingHorizontal: 20, borderRadius: 14, backgroundColor: MP.gold, alignItems: 'center', justifyContent: 'center' },
  goldBtnHover: { backgroundColor: MP.goldLight },
  goldBtnText: { color: MP.textOnGold, fontWeight: MP_FONT.weight.heavy, fontSize: MP_FONT.size.md },


  body:    { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  filters: { width: 220, gap: 4 },
  kicker:  { color: MP.textMuted, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  kickerSpaced: { marginTop: 18 },
  catItem: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  catItemHover:  { backgroundColor: MP.surface },
  catItemActive: { backgroundColor: MP.purpleSubtle },
  catText:       { color: MP.text, fontSize: MP_FONT.size.md },
  catTextActive: { color: MP.purpleLight, fontWeight: MP_FONT.weight.bold },
  sortActive:    { backgroundColor: MP.goldSubtle },
  sortTextActive: { color: MP.goldLight, fontWeight: MP_FONT.weight.bold },
  creatorCard: { marginTop: 20, padding: 16, gap: 8, borderRadius: 16, backgroundColor: MP.surface, borderWidth: 1, borderColor: MP.border },
  creatorCardHover: { borderColor: MP.purpleLight },
  creatorTitle: { color: MP.text, fontWeight: MP_FONT.weight.bold, fontSize: MP_FONT.size.md },
  creatorText:  { color: MP.textSoft, fontSize: 12, lineHeight: 17 },
  creatorLink:  { color: MP.purpleLight, fontWeight: MP_FONT.weight.bold, fontSize: 13 },

  main:      { flex: 1, minWidth: 0, gap: 14 },
  mainHead:  { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md },
  mainTitle: { color: MP.text, fontSize: 17, fontWeight: MP_FONT.weight.bold, flexShrink: 1 },
  mainCount: { color: MP.textMuted, fontSize: 13 },
  note:      { color: MP.textMuted, fontSize: 12 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, minHeight: 200 },
  cardCell:  { borderRadius: borderRadius.lg },
  cardCellHover: { transform: [{ translateY: -3 }] },

  skeleton:      { borderRadius: borderRadius.lg, overflow: 'hidden', backgroundColor: MP.surface, borderWidth: 1, borderColor: MP.border, paddingBottom: 14, gap: 10 },
  skeletonCover: { width: '100%', backgroundColor: MP.bgElevated },
  skeletonLineWide: { height: 14, width: '75%', marginHorizontal: 12, borderRadius: 6, backgroundColor: MP.bgElevated },
  skeletonLine:  { height: 12, width: '40%', marginHorizontal: 12, borderRadius: 6, backgroundColor: MP.bgElevated },

  stateBox:   { width: '100%', minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateTitle: { color: MP.text, fontSize: MP_FONT.size.lg, fontWeight: MP_FONT.weight.bold },
  stateText:  { color: MP.textSoft, fontSize: MP_FONT.size.md },

  moreBtn:  { alignSelf: 'center', minWidth: 220, height: 46, paddingHorizontal: 32, borderRadius: borderRadius.full, borderWidth: 1, borderColor: MP.borderGold, backgroundColor: MP.goldSubtle, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  moreText: { color: MP.goldLight, fontWeight: MP_FONT.weight.bold, fontSize: MP_FONT.size.md },
});

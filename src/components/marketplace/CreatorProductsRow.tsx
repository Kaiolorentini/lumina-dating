// ============================================
// LUMINA — CONTEÚDOS DO CRIADOR NO PERFIL
// src/components/marketplace/CreatorProductsRow.tsx
//
// Faixa horizontal com os produtos à venda de quem tem o perfil
// aberto (decisões de Kaio, 08/10/2026):
//   1A — logo depois da galeria; tocar abre o produto;
//   2B — todos os produtos, carregando aos poucos ao rolar;
//   3A — só aparece se a pessoa for criadora e tiver pelo menos
//        1 produto aprovado à venda. Sem produto, a seção some.
//
// Reaproveita o ProductCard do marketplace (variante compacta,
// feita para faixas horizontais): estrelas, preço e "Novo" iguais
// aos da vitrine.
// ============================================

import React, { useCallback } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { ProductCard } from './ProductCard';
import { useCreatorProducts } from '../../hooks/useCreatorProducts';
import { Product } from '../../shared/types/marketplace';

interface Props {
  ownerId: string;
  /** Primeiro nome para o título da seção. */
  ownerName?: string;
  /** Só busca quando o dono pode vender (criador/admin) e o
   *  marketplace está aberto. Fora disso, nenhuma leitura. */
  enabled: boolean;
  onOpenProduct: (productId: string) => void;
}

export default function CreatorProductsRow({ ownerId, ownerName, enabled, onOpenProduct }: Props) {
  const { products, loading, loadingMore, hasMore, error, loadMore, refresh } =
    useCreatorProducts(ownerId, enabled);

  const renderItem = useCallback(({ item }: { item: Product }) => (
    <ProductCard product={item} compact onPress={() => onOpenProduct(item.id)} />
  ), [onOpenProduct]);

  if (!enabled) return null;

  // 3A: sem produto à venda, a seção não existe.
  if (!loading && !error && products.length === 0) return null;

  const firstName = (ownerName ?? '').trim().split(/\s+/)[0];
  const title = firstName ? `🛍️ Conteúdos de ${firstName}` : '🛍️ Conteúdos à venda';

  return (
    <View style={styles.section} accessibilityLabel={title}>
      <Text style={styles.title}>{title}</Text>

      {loading && products.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error && products.length === 0 ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh} accessibilityRole="button">
            <Text style={styles.retryText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => p.id}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onEndReached={() => { if (hasMore) loadMore(); }}
          onEndReachedThreshold={0.5}
          initialNumToRender={3}
          windowSize={5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.moreLoader}>
                <ActivityIndicator color={colors.gold} size="small" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section:     { gap: spacing.sm },
  title:       { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold', letterSpacing: 1 },
  listContent: { paddingRight: spacing.sm },
  loadingBox:  { height: 120, alignItems: 'center', justifyContent: 'center' },
  errorBox:    {
    alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark,
  },
  errorText:   { color: colors.gray, fontSize: fonts.sizes.sm },
  retryText:   { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  moreLoader:  { width: 60, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});

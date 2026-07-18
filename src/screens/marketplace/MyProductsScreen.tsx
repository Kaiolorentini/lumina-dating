import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useProducts } from '../../hooks/useProducts';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import { Product, ProductStatus } from '../../shared/types/marketplace';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_CONFIG: Record<ProductStatus, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: colors.gray },
  pending: { label: 'Em análise', color: colors.gold },
  approved: { label: 'Aprovado', color: colors.success },
  rejected: { label: 'Rejeitado', color: colors.error },
};

export default function MyProductsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();

  const { products, loading, loadMore, hasMore, loadingMore, refresh } = useProducts({
    ownerId: user?.uid,
  });

  const renderItem = useCallback(({ item }: { item: Product }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('EditProduct', { productId: item.id })}
        activeOpacity={0.85}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.cardCategory}>{item.category}</Text>
            <Text style={styles.cardPrice}>
              {item.isFree ? 'Grátis' : `R$ ${item.price.toFixed(2)}`}
            </Text>
          </View>
          <View style={styles.cardMeta}>
            <View style={[styles.statusBadge, { borderColor: statusConfig.color }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
            {item.reviewsCount > 0 && (
              <Text style={styles.rating}>
                ⭐ {item.averageRating.toFixed(1)}
              </Text>
            )}
          </View>
        </View>
        {item.status === 'rejected' && item.rejectionReason && (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionText}>
              ❌ Motivo: {item.rejectionReason}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, []);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meus Produtos</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateProduct')}>
          <Text style={styles.addBtn}>+</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />
          }
          onEndReached={() => { if (hasMore) loadMore(); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <MarketplaceEmptyState
              icon="📦"
              title="Nenhum produto ainda"
              subtitle="Crie seu primeiro produto digital"
            />
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.gold} /> : null}
          renderItem={renderItem}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateProduct')}
      >
        <Text style={styles.fabText}>+ Novo produto</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  addBtn: { color: colors.gold, fontSize: 28, fontWeight: 'bold' },
  listContent: { padding: spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardInfo: { flex: 1, marginRight: spacing.md },
  cardTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', marginBottom: spacing.xs },
  cardCategory: { color: colors.gray, fontSize: fonts.sizes.sm, textTransform: 'capitalize', marginBottom: spacing.xs },
  cardPrice: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  cardMeta: { alignItems: 'flex-end', gap: spacing.sm },
  statusBadge: {
    borderWidth: 1, borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2,
  },
  statusText: { fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  rating: { color: colors.gray, fontSize: fonts.sizes.sm },
  rejectionBox: {
    backgroundColor: colors.error + '11', borderRadius: borderRadius.sm,
    padding: spacing.sm, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.error + '44',
  },
  rejectionText: { color: colors.error, fontSize: fonts.sizes.sm },
  fab: {
    position: 'absolute', bottom: spacing.xl, left: spacing.md, right: spacing.md,
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center',
  },
  fabText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
});
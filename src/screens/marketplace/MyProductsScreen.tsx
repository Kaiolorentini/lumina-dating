import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha} from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useProducts } from '../../hooks/useProducts';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import { Product, ProductStatus } from '../../shared/types/marketplace';
import ScreenContainer from '../../components/ScreenContainer';
import { Badge, Button, Card } from '../../components/ui';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_VARIANT: Record<ProductStatus, 'default' | 'premium' | 'success' | 'error'> = {
  draft: 'default',
  pending: 'premium',
  approved: 'success',
  rejected: 'error',
};

const STATUS_LABEL: Record<ProductStatus, string> = {
  draft: 'Rascunho',
  pending: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

export default function MyProductsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { products, loading, loadMore, hasMore, loadingMore, refresh, error } = useProducts({ ownerId: user?.uid });

  const renderItem = useCallback(({ item }: { item: Product }) => (
    <Card padding={SPACING.md} onPress={() => navigation.navigate('EditProduct', { productId: item.id })}>
      <View style={styles.cardRow}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardCategory}>{item.category}</Text>
          <Text style={styles.cardPrice}>{item.isFree ? 'Grátis' : `R$ ${item.price.toFixed(2)}`}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Badge label={STATUS_LABEL[item.status]} variant={STATUS_VARIANT[item.status]} size="sm" />
          {item.reviewsCount > 0 && <Text style={styles.rating}>⭐ {item.averageRating.toFixed(1)}</Text>}
        </View>
      </View>
      {item.status === 'rejected' && item.rejectionReason && (
        <View style={styles.rejectionBox}>
          <Text style={styles.rejectionText}>❌ Motivo: {item.rejectionReason}</Text>
        </View>
      )}
    </Card>
  ), []);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Meus Produtos</Text>
        <Button label="+" variant="ghost" onPress={() => navigation.navigate('CreateProduct')} />
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Erro ao carregar produtos</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <Button label="Tentar novamente" onPress={refresh} variant="ghost" />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={COLORS.gold} />}
          onEndReached={() => { if (hasMore) loadMore(); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<MarketplaceEmptyState icon="📦" title="Nenhum produto ainda" subtitle="Crie seu primeiro produto digital" />}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.gold} /> : null}
          renderItem={renderItem}
        />
      )}

      <Button label="+ Novo produto" onPress={() => navigation.navigate('CreateProduct')} variant="primary" style={styles.fab} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: alpha(COLORS.gold, 0.27) },
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  listContent: { padding: SPACING.md, paddingBottom: 100 },
  // card removed — now uses <Card>
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardInfo: { flex: 1, marginRight: SPACING.md },
  cardTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
  cardCategory: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, textTransform: 'capitalize', marginBottom: SPACING.xs },
  cardPrice: { color: COLORS.gold, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  cardMeta: { alignItems: 'flex-end', gap: SPACING.sm },
  rating: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  rejectionBox: { backgroundColor: alpha(COLORS.error, 0.07), borderRadius: BORDER_RADIUS.sm, padding: SPACING.sm, marginTop: SPACING.sm, borderWidth: 1, borderColor: alpha(COLORS.error, 0.27) },
  rejectionText: { color: COLORS.error, fontSize: FONT_SIZE.caption },
  fab: { position: 'absolute', bottom: SPACING.xl, left: SPACING.md, right: SPACING.md },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.md },
  errorText: { color: COLORS.gold, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm },
  errorDetail: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, textAlign: 'center', marginBottom: SPACING.md },
  // retryBtn/retryBtnText removed — now uses Button
});

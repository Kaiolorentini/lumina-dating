import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Input } from '../../components/ui';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { getProducts } from '../../services/marketplace/productService';
import { getUserById } from '../../services/marketplace/adminService';
import { Product } from '../../shared/types/marketplace';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type StatusTab = 'pending' | 'approved' | 'rejected';
const STATUS_TABS: StatusTab[] = ['pending', 'approved', 'rejected'];

// getProducts() não converte createdAt (Timestamp) para Date — trata os dois casos
function formatDate(value: any): string {
  try {
    const d = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
    if (!d) return '';
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

function formatPrice(product: Product): string {
  if (product.isFree || product.price === 0) return 'Grátis';
  return `R$ ${product.price.toFixed(2).replace('.', ',')}`;
}

export default function AdminProductsModerationScreen() {
  const navigation = useNavigation<NavProp>();
  const { blocked, loading: guardLoading } = useAdminGuard();
  const [activeTab, setActiveTab] = useState<StatusTab>('pending');
  const [products, setProducts] = useState<Product[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getProducts({ status: activeTab, pageSize: 20 });
      setProducts(result.products);

      const names: Record<string, string> = {};
      await Promise.all(
        result.products.map(async prod => {
          try {
            const profile = await getUserById(prod.ownerId);
            names[prod.ownerId] = profile?.name ?? prod.ownerId.slice(0, 12) + '...';
          } catch {
            names[prod.ownerId] = prod.ownerId.slice(0, 12) + '...';
          }
        })
      );
      setUserNames(names);
    } catch (e: any) {
      console.error('[AdminProductsModeration] Erro:', e);
      setError(e.message ?? 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  React.useEffect(() => { loadProducts(); }, [activeTab]);

  if (guardLoading || blocked) return null;

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Moderação de Produtos</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {STATUS_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'pending' ? 'Pendentes' : tab === 'approved' ? 'Aprovados' : 'Rejeitados'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Conteúdo */}
      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadProducts}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={loadProducts}
              tintColor={COLORS.gold}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>
                Nenhum produto {
                  activeTab === 'pending' ? 'pendente' :
                  activeTab === 'approved' ? 'aprovado' : 'rejeitado'
                }
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('AdminProductReview', { productId: item.id })}
            >
              <Text style={styles.cardTitle}>📦 {item.title}</Text>
              <View style={styles.cardMetaRow}>
                <Text style={styles.cardCategory}>{item.category}</Text>
                <Text style={styles.cardPrice}>{formatPrice(item)}</Text>
              </View>
              <Text style={styles.cardOwner}>
                👤 {userNames[item.ownerId] || item.ownerId.slice(0, 16) + '...'}
              </Text>
              <Text style={styles.cardDate}>📅 {formatDate(item.createdAt)}</Text>

              {activeTab === 'rejected' && item.rejectionReason && (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Motivo da rejeição:</Text>
                  <Text style={styles.reasonText}>{item.rejectionReason}</Text>
                </View>
              )}

              <Text style={styles.tapHint}>Toque para revisar →</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.gold + '44',
  },
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  tab: { flex: 1, padding: SPACING.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.gold },
  tabText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  tabTextActive: { color: COLORS.gold, fontWeight: FONT_WEIGHT.bold },
  list: { padding: SPACING.md },
  card: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  cardTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  cardMetaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardCategory: { color: COLORS.gold, fontSize: FONT_SIZE.xs, textTransform: 'capitalize' },
  cardPrice: { color: COLORS.textPrimary, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  cardOwner: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  cardDate: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  reasonBox: {
    marginTop: SPACING.xs, padding: SPACING.sm,
    backgroundColor: COLORS.error + '11', borderRadius: BORDER_RADIUS.sm,
    borderLeftWidth: 2, borderLeftColor: COLORS.error,
  },
  reasonLabel: { color: COLORS.error, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  reasonText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.caption, marginTop: 2 },
  tapHint: { color: COLORS.gold, fontSize: FONT_SIZE.xs, marginTop: SPACING.xs, alignSelf: 'flex-end' },
  errorContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: SPACING.xl,
  },
  errorIcon: { fontSize: 48 },
  errorText: { color: COLORS.error, fontSize: FONT_SIZE.body, textAlign: 'center' },
  retryBtn: {
    backgroundColor: COLORS.gold, borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md, paddingHorizontal: SPACING.xl,
  },
  retryBtnText: { color: COLORS.background, fontWeight: FONT_WEIGHT.bold },
  empty: { flex: 1, alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, textAlign: 'center' },
});

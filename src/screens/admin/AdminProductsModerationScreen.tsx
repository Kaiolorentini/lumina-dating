import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
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
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
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
              tintColor={colors.gold}
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
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.grayDark },
  tab: { flex: 1, padding: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabText: { color: colors.gray, fontSize: fonts.sizes.sm },
  tabTextActive: { color: colors.gold, fontWeight: 'bold' },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  cardMetaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardCategory: { color: colors.gold, fontSize: fonts.sizes.xs, textTransform: 'capitalize' },
  cardPrice: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  cardOwner: { color: colors.gray, fontSize: fonts.sizes.xs },
  cardDate: { color: colors.gray, fontSize: fonts.sizes.xs },
  reasonBox: {
    marginTop: spacing.xs, padding: spacing.sm,
    backgroundColor: colors.error + '11', borderRadius: borderRadius.sm,
    borderLeftWidth: 2, borderLeftColor: colors.error,
  },
  reasonLabel: { color: colors.error, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  reasonText: { color: colors.white, fontSize: fonts.sizes.sm, marginTop: 2 },
  tapHint: { color: colors.gold, fontSize: fonts.sizes.xs, marginTop: spacing.xs, alignSelf: 'flex-end' },
  errorContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl,
  },
  errorIcon: { fontSize: 48 },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.sm,
    padding: spacing.md, paddingHorizontal: spacing.xl,
  },
  retryBtnText: { color: colors.background, fontWeight: 'bold' },
  empty: { flex: 1, alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
});
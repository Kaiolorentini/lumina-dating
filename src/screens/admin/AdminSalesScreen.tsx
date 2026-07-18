import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DocumentSnapshot } from 'firebase/firestore';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { getAllSales, getUserById } from '../../services/marketplace/adminService';
import { Sale } from '../../shared/types/marketplace';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';

function formatDate(value: any): string {
  try {
    const d = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
    if (!d) return '';
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return '';
  }
}

function formatMoney(v: number | undefined): string {
  const n = typeof v === 'number' ? v : 0;
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

// Prioridade: chargeback é condição especial, acima do status
function saleStatusInfo(sale: Sale): { label: string; color: string } {
  if (sale.isChargebacked) return { label: '⚠️ Chargeback', color: colors.error };
  switch (sale.status) {
    case 'refunded':
      return { label: '↩️ Reembolsada', color: colors.error };
    case 'partially_refunded':
      return { label: '↩️ Reemb. parcial', color: colors.error };
    case 'refund_requested':
      return { label: '⏳ Reembolso solicitado', color: colors.gold };
    case 'paid':
      return { label: '🟢 Pago', color: colors.success };
    case 'pending':
    default:
      return { label: '⏳ Pendente', color: colors.gray };
  }
}

function methodLabel(method: string): string {
  if (method === 'pix') return 'PIX';
  if (method === 'credit_card') return 'Cartão';
  if (method === 'free') return 'Grátis';
  return method;
}

export default function AdminSalesScreen() {
  const navigation = useNavigation();
  const { blocked, loading: guardLoading } = useAdminGuard();
  const [sales, setSales] = useState<Sale[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const resolveNames = useCallback(async (list: Sale[]) => {
    const ids = new Set<string>();
    list.forEach(s => { ids.add(s.buyerId); ids.add(s.sellerId); });
    const names: Record<string, string> = {};
    await Promise.all(
      Array.from(ids).map(async id => {
        try {
          const p = await getUserById(id);
          names[id] = p?.name ?? id.slice(0, 10) + '...';
        } catch {
          names[id] = id.slice(0, 10) + '...';
        }
      })
    );
    setUserNames(prev => ({ ...prev, ...names }));
  }, []);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAllSales(20, null);
      setSales(result.sales);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
      await resolveNames(result.sales);
    } catch (e: any) {
      console.error('[AdminSales] Erro:', e);
      setError(e.message ?? 'Erro ao carregar vendas');
    } finally {
      setLoading(false);
    }
  }, [resolveNames]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const result = await getAllSales(20, lastDoc);
      setSales(prev => [...prev, ...result.sales]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
      await resolveNames(result.sales);
    } catch (e: any) {
      console.error('[AdminSales] Erro ao carregar mais:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, lastDoc, resolveNames]);

  React.useEffect(() => { loadSales(); }, []);

  if (guardLoading || blocked) return null;

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vendas</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadSales}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={loadSales} tintColor={colors.gold} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💳</Text>
              <Text style={styles.emptyText}>Nenhuma venda encontrada</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <ActivityIndicator color={colors.gold} size="small" />
                ) : (
                  <Text style={styles.loadMoreText}>Carregar mais</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => {
            const status = saleStatusInfo(item);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardId}>Venda #{item.id.slice(0, 8)}</Text>
                  <View style={[styles.statusBadge, { borderColor: status.color }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>

                {/* Valores */}
                <View style={styles.valuesRow}>
                  <View style={styles.valueBox}>
                    <Text style={styles.valueLabel}>Valor</Text>
                    <Text style={styles.valueMain}>{formatMoney(item.amount)}</Text>
                  </View>
                  <View style={styles.valueBox}>
                    <Text style={styles.valueLabel}>Comissão</Text>
                    <Text style={styles.valueSecondary}>{formatMoney(item.platformCommission)}</Text>
                  </View>
                  <View style={styles.valueBox}>
                    <Text style={styles.valueLabel}>Criador</Text>
                    <Text style={styles.valueSecondary}>{formatMoney(item.sellerAmount)}</Text>
                  </View>
                </View>

                {item.couponCode ? (
                  <Text style={styles.coupon}>
                    🎟️ Cupom {item.couponCode}
                    {item.discountAmount ? ` (−${formatMoney(item.discountAmount)})` : ''}
                  </Text>
                ) : null}

                {/* Partes */}
                <Text style={styles.party}>
                  🛒 Comprador: <Text style={styles.partyValue}>{userNames[item.buyerId] ?? item.buyerId.slice(0, 10) + '...'}</Text>
                </Text>
                <Text style={styles.party}>
                  🎨 Vendedor: <Text style={styles.partyValue}>{userNames[item.sellerId] ?? item.sellerId.slice(0, 10) + '...'}</Text>
                </Text>
                <Text style={styles.party}>
                  📦 Produto: <Text style={styles.partyValue}>{item.productId.slice(0, 14)}...</Text>
                </Text>

                {/* Método + datas */}
                <View style={styles.footerRow}>
                  <Text style={styles.method}>{methodLabel(item.paymentMethod)}</Text>
                  <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                </View>
                {item.paidAt ? (
                  <Text style={styles.paidAt}>Pago em {formatDate(item.paidAt)}</Text>
                ) : null}
              </View>
            );
          }}
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
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
    gap: spacing.xs,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardId: { color: colors.gray, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  statusBadge: {
    borderRadius: borderRadius.sm, borderWidth: 1,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  statusText: { fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  valuesRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: spacing.sm, marginBottom: spacing.xs,
  },
  valueBox: { flex: 1 },
  valueLabel: { color: colors.gray, fontSize: fonts.sizes.xs },
  valueMain: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  valueSecondary: { color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  coupon: { color: colors.gold, fontSize: fonts.sizes.xs },
  party: { color: colors.gray, fontSize: fonts.sizes.xs },
  partyValue: { color: colors.white },
  footerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  method: {
    color: colors.gold, fontSize: fonts.sizes.xs, fontWeight: 'bold',
    borderWidth: 1, borderColor: colors.gold + '55', borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 1,
  },
  date: { color: colors.gray, fontSize: fonts.sizes.xs },
  paidAt: { color: colors.success, fontSize: fonts.sizes.xs },
  loadMoreBtn: {
    padding: spacing.md, alignItems: 'center', marginTop: spacing.sm,
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.grayDark,
  },
  loadMoreText: { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.sm },
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
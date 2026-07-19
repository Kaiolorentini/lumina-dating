import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Input } from '../../components/ui';
import { DocumentSnapshot } from 'firebase/firestore';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';
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
  if (sale.isChargebacked) return { label: '⚠️ Chargeback', color: COLORS.error };
  switch (sale.status) {
    case 'refunded':
      return { label: '↩️ Reembolsada', color: COLORS.error };
    case 'partially_refunded':
      return { label: '↩️ Reemb. parcial', color: COLORS.error };
    case 'refund_requested':
      return { label: '⏳ Reembolso solicitado', color: COLORS.gold };
    case 'paid':
      return { label: '🟢 Pago', color: COLORS.success };
    case 'pending':
    default:
      return { label: '⏳ Pendente', color: COLORS.textSecondary };
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
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Vendas</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ flex: 1 }} />
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
            <RefreshControl refreshing={false} onRefresh={loadSales} tintColor={COLORS.gold} />
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
                  <ActivityIndicator color={COLORS.gold} size="small" />
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.gold + '44',
  },
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  list: { padding: SPACING.md },
  card: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardId: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  statusBadge: {
    borderRadius: BORDER_RADIUS.sm, borderWidth: 1,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  valuesRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: SPACING.sm, marginBottom: SPACING.xs,
  },
  valueBox: { flex: 1 },
  valueLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  valueMain: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  valueSecondary: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  coupon: { color: COLORS.gold, fontSize: FONT_SIZE.xs },
  party: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  partyValue: { color: COLORS.textPrimary },
  footerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  method: {
    color: COLORS.gold, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold,
    borderWidth: 1, borderColor: COLORS.gold + '55', borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 1,
  },
  date: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  paidAt: { color: COLORS.success, fontSize: FONT_SIZE.xs },
  loadMoreBtn: {
    padding: SPACING.md, alignItems: 'center', marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  loadMoreText: { color: COLORS.gold, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.caption },
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

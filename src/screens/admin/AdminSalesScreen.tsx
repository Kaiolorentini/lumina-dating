// ============================================
// LUMINA — VENDAS (ADMIN) v2
// src/screens/admin/AdminSalesScreen.tsx
//
// v2 (28/09): abas Marketplace e Cristais e Galáxia, cada uma com o
// total do mês no topo (contadores do servidor).
//
// Marketplace: as vendas de produto não têm campo `type`, então a lista
// pagina todas as vendas e deixa só as que não são de cristais.
// Cristais: consulta direta por type == 'coins_purchase'.
// ============================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DocumentSnapshot } from 'firebase/firestore';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { getAllSales, getCoinsSales, getUserById } from '../../services/marketplace/adminService';
import { formatBRL } from '../../services/marketplace/adminDashboardService';
import { useAdminDashboard } from '../../hooks/useAdminDashboard';
import { Sale } from '../../shared/types/marketplace';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';

/** Campos gravados nas vendas de cristais, além dos do tipo Sale. */
type SaleRow = Sale & { type?: string; packageLabel?: string; isSubscription?: boolean };
type Tab = 'marketplace' | 'coins';

const PAGE = 20;
const MAX_SCAN_PAGES = 5;

function formatDate(d: Date | undefined): string {
  if (!d) return '';
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function statusInfo(sale: SaleRow): { label: string; color: string } {
  if (sale.isChargebacked) return { label: '⚠️ Chargeback', color: colors.error };
  switch (sale.status) {
    case 'paid':             return { label: '🟢 Pago', color: colors.success };
    case 'refunded':         return { label: '↩️ Reembolsada', color: colors.error };
    case 'refund_requested': return { label: '⏳ Reembolso pedido', color: colors.gold };
    case 'cancelled':        return { label: 'Cancelada', color: colors.gray };
    case 'overdue':          return { label: 'Vencida', color: colors.gray };
    default:                 return { label: '⏳ Pendente', color: colors.gray };
  }
}

export default function AdminSalesScreen() {
  const navigation = useNavigation();
  const { blocked, loading: guardLoading } = useAdminGuard();
  const { data: dashboard } = useAdminDashboard(!blocked && !guardLoading);

  const [tab, setTab]                 = useState<Tab>('marketplace');
  const [sales, setSales]             = useState<SaleRow[]>([]);
  const [names, setNames]             = useState<Record<string, string>>({});
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [cursor, setCursor]           = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore]         = useState(false);

  const resolveNames = useCallback(async (list: SaleRow[]) => {
    const ids = Array.from(new Set(list.flatMap(s => [s.buyerId, s.sellerId])
      .filter(id => id && id !== 'lumina_platform')));
    const entries = await Promise.all(ids.map(async id => {
      const u = await getUserById(id).catch(() => null);
      return [id, u?.name ?? `${id.slice(0, 10)}…`] as const;
    }));
    setNames(prev => ({ ...prev, ...Object.fromEntries(entries) }));
  }, []);

  /** Uma página da aba atual, a partir do cursor. */
  const fetchPage = useCallback(async (from: DocumentSnapshot | null) => {
    if (tab === 'coins') {
      const r = await getCoinsSales(PAGE, from);
      return { rows: r.sales as SaleRow[], cursor: r.lastDoc, hasMore: r.hasMore };
    }
    // Marketplace: pagina todas e filtra, até encher uma página.
    let rows: SaleRow[] = [];
    let next = from;
    let more = true;
    for (let i = 0; i < MAX_SCAN_PAGES && rows.length < PAGE && more; i++) {
      const r = await getAllSales(PAGE, next);
      rows = rows.concat((r.sales as SaleRow[]).filter(s => s.type !== 'coins_purchase'));
      next = r.lastDoc;
      more = r.hasMore;
    }
    return { rows, cursor: next, hasMore: more };
  }, [tab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(null);
      setSales(page.rows);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      await resolveNames(page.rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar vendas.');
    } finally {
      setLoading(false);
    }
  }, [fetchPage, resolveNames]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursor);
      setSales(prev => [...prev, ...page.rows]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      await resolveNames(page.rows);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, cursor, fetchPage, resolveNames]);

  useEffect(() => { load(); }, [load]);

  if (guardLoading || blocked) return null;

  const m = dashboard?.metrics;
  const monthTotal = tab === 'coins' ? m?.monthlyCoinsRevenue : m?.monthlyMarketplaceRevenue;
  const monthCount = tab === 'coins' ? m?.monthlyCoinsSales : m?.monthlyMarketplaceSales;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vendas</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        {(['marketplace', 'coins'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)} accessibilityRole="tab">
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'marketplace' ? '🛍️ Marketplace' : '💎 Cristais e Galáxia'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Este mês</Text>
        <Text style={styles.summaryValue}>{formatBRL(monthTotal)}</Text>
        <Text style={styles.summarySub}>
          {monthCount ?? 0} {monthCount === 1 ? 'venda' : 'vendas'}
          {tab === 'marketplace' && m ? ` · comissão ${formatBRL(m.monthlyCommission)}` : ''}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.gold} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💳</Text>
              <Text style={styles.emptyText}>Nenhuma venda nesta aba</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.gold} style={{ margin: spacing.md }} /> : null}
          renderItem={({ item }) => {
            const st = statusInfo(item);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {tab === 'coins'
                      ? (item.isSubscription ? '🌌 Galáxia Plus' : `💎 ${item.packageLabel ?? 'Pacote de cristais'}`)
                      : `Venda #${item.id.slice(0, 8)}`}
                  </Text>
                  <View style={[styles.statusBadge, { borderColor: st.color }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                <View style={styles.valuesRow}>
                  <View style={styles.valueBox}>
                    <Text style={styles.valueLabel}>Valor</Text>
                    <Text style={styles.valueMain}>{formatBRL(item.amount)}</Text>
                  </View>
                  {tab === 'marketplace' && (
                    <>
                      <View style={styles.valueBox}>
                        <Text style={styles.valueLabel}>Comissão</Text>
                        <Text style={styles.valueSecondary}>{formatBRL(item.platformCommission)}</Text>
                      </View>
                      <View style={styles.valueBox}>
                        <Text style={styles.valueLabel}>Criador</Text>
                        <Text style={styles.valueSecondary}>{formatBRL(item.sellerAmount)}</Text>
                      </View>
                    </>
                  )}
                </View>

                {item.couponCode ? (
                  <Text style={styles.coupon}>🎟️ Cupom {item.couponCode}{item.discountAmount ? ` (−${formatBRL(item.discountAmount)})` : ''}</Text>
                ) : null}

                <Text style={styles.party}>🛒 Comprador: <Text style={styles.partyValue}>{names[item.buyerId] ?? '…'}</Text></Text>
                {tab === 'marketplace' && (
                  <Text style={styles.party}>🎨 Criador: <Text style={styles.partyValue}>{names[item.sellerId] ?? '…'}</Text></Text>
                )}
                <Text style={styles.date}>{formatDate(item.createdAt)}{item.paidAt ? ` · pago ${formatDate(item.paidAt)}` : ''}</Text>
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.grayDark },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabText: { color: colors.gray, fontSize: fonts.sizes.sm },
  tabTextActive: { color: colors.gold, fontWeight: 'bold' },
  summary: {
    margin: spacing.md, marginBottom: 0, padding: spacing.md, borderRadius: borderRadius.md,
    backgroundColor: colors.gold + '11', borderWidth: 1, borderColor: colors.gold + '44', alignItems: 'center',
  },
  summaryLabel: { color: colors.gold, fontSize: fonts.sizes.xs, fontWeight: 'bold', letterSpacing: 1 },
  summaryValue: { color: colors.white, fontSize: fonts.sizes.xxl, fontWeight: 'bold', marginVertical: 2 },
  summarySub: { color: colors.gray, fontSize: fonts.sizes.xs },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md, gap: spacing.xs,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { flex: 1, color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  statusBadge: { borderRadius: borderRadius.sm, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  valuesRow: { flexDirection: 'row', marginVertical: spacing.xs },
  valueBox: { flex: 1 },
  valueLabel: { color: colors.gray, fontSize: fonts.sizes.xs },
  valueMain: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  valueSecondary: { color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  coupon: { color: colors.gold, fontSize: fonts.sizes.xs },
  party: { color: colors.gray, fontSize: fonts.sizes.xs },
  partyValue: { color: colors.white },
  date: { color: colors.gray, fontSize: fonts.sizes.xs },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn: { backgroundColor: colors.gold, borderRadius: borderRadius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { color: colors.background, fontWeight: 'bold' },
});
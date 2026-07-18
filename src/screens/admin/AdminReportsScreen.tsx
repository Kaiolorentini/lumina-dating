import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { getAdminMetrics, listenToAdminMetrics } from '../../services/marketplace/adminService';
import { AdminMetrics } from '../../shared/types/marketplace';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';

function money(v: number | undefined): string {
  const n = typeof v === 'number' ? v : 0;
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

function num(v: number | undefined): string {
  return String(typeof v === 'number' ? v : 0);
}

function formatDate(value: any): string {
  try {
    const d = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
    if (!d) return '';
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return '';
  }
}

interface StatProps {
  label: string;
  value: string;
  highlight?: boolean;
  danger?: boolean;
  warn?: boolean;
}

function Stat({ label, value, highlight, danger, warn }: StatProps) {
  const color = danger ? colors.error : warn ? colors.gold : highlight ? colors.success : colors.white;
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }, highlight && styles.statHighlight]}>{value}</Text>
    </View>
  );
}

export default function AdminReportsScreen() {
  const navigation = useNavigation();
  const { blocked, loading: guardLoading } = useAdminGuard();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(true);

  useEffect(() => {
    // Busca inicial + listener em tempo real
    let unsub: (() => void) | null = null;

    getAdminMetrics()
      .then(m => {
        setMetrics(m);
        setExists(m !== null);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    unsub = listenToAdminMetrics(m => {
      setMetrics(m);
      setExists(m !== null);
      setLoading(false);
    });

    return () => { if (unsub) unsub(); };
  }, []);

  async function reload() {
    setLoading(true);
    const m = await getAdminMetrics();
    setMetrics(m);
    setExists(m !== null);
    setLoading(false);
  }

  if (guardLoading || blocked) return null;

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Relatórios</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : !exists || !metrics ? (
        <ScrollView
          contentContainerStyle={styles.emptyWrap}
          refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.gold} />}
        >
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>Ainda não há métricas</Text>
          <Text style={styles.emptyText}>
            As métricas do marketplace aparecem aqui após a primeira venda paga.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.gold} />}
        >
          {/* Financeiro — destaque */}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Receita total</Text>
            <Text style={styles.heroValue}>{money(metrics.monthlyRevenue)}</Text>
            <Text style={styles.heroSub}>Comissão da plataforma: {money(metrics.totalCommission)}</Text>
          </View>

          {/* Hoje */}
          <Text style={styles.sectionTitle}>Hoje</Text>
          <View style={styles.grid}>
            <Stat label="Vendas hoje" value={num(metrics.todaySales)} />
            <Stat label="Receita hoje" value={money(metrics.todayRevenue)} highlight />
          </View>

          {/* Mês */}
          <Text style={styles.sectionTitle}>Este mês</Text>
          <View style={styles.grid}>
            <Stat label="Receita mensal" value={money(metrics.monthlyRevenue)} highlight />
            <Stat label="Comissão mensal" value={money(metrics.monthlyCommission)} />
          </View>

          {/* Vendas & downloads */}
          <Text style={styles.sectionTitle}>Vendas & Conteúdo</Text>
          <View style={styles.grid}>
            <Stat label="Total de vendas" value={num(metrics.totalSales)} />
            <Stat label="Produtos vendidos" value={num(metrics.totalProductsSold)} />
            <Stat label="Downloads" value={num(metrics.totalDownloads)} />
            <Stat label="Sacado (criadores)" value={money(metrics.totalWithdrawn)} />
          </View>

          {/* Catálogo */}
          <Text style={styles.sectionTitle}>Catálogo</Text>
          <View style={styles.grid}>
            <Stat label="Produtos ativos" value={num(metrics.activeProducts)} />
            <Stat label="Total de produtos" value={num(metrics.totalProducts)} />
            <Stat label="Criadores ativos" value={num(metrics.activeCreators)} />
            <Stat label="Total de criadores" value={num(metrics.totalCreators)} />
          </View>

          {/* Operação — pendências */}
          <Text style={styles.sectionTitle}>Pendências</Text>
          <View style={styles.grid}>
            <Stat label="Produtos p/ aprovar" value={num(metrics.pendingProducts)} warn={!!metrics.pendingProducts} />
            <Stat label="Saques pendentes" value={num(metrics.pendingWithdrawals)} warn={!!metrics.pendingWithdrawals} />
            <Stat label="Vendas pendentes" value={num(metrics.totalPendingSales)} />
          </View>

          {/* Alertas */}
          <Text style={styles.sectionTitle}>Alertas</Text>
          <View style={styles.grid}>
            <Stat label="Reembolsos" value={num(metrics.totalRefunds)} danger={!!metrics.totalRefunds} />
            <Stat label="Chargebacks" value={num(metrics.totalChargebacks)} danger={!!metrics.totalChargebacks} />
          </View>

          {/* Rodapé */}
          <Text style={styles.updatedAt}>
            Atualizado: {formatDate(metrics.updatedAt)}
          </Text>
          {metrics.lastRebuiltAt ? (
            <Text style={styles.updatedAt}>
              Reconstruído: {formatDate(metrics.lastRebuiltAt)}
            </Text>
          ) : null}
        </ScrollView>
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
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  heroCard: {
    backgroundColor: colors.gold + '11', borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.gold + '44',
    padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md,
  },
  heroLabel: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  heroValue: { color: colors.white, fontSize: 34, fontWeight: 'bold', marginVertical: spacing.xs },
  heroSub: { color: colors.gray, fontSize: fonts.sizes.sm },
  sectionTitle: {
    color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold',
    marginTop: spacing.md, marginBottom: spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.md, flexGrow: 1, flexBasis: '45%', minWidth: '45%',
  },
  statLabel: { color: colors.gray, fontSize: fonts.sizes.xs },
  statValue: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', marginTop: 2 },
  statHighlight: { fontSize: fonts.sizes.xl },
  updatedAt: { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: spacing.md, textAlign: 'center' },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center', lineHeight: 22 },
});
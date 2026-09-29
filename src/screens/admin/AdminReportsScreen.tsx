// ============================================
// LUMINA — RELATÓRIOS (ADMIN) v2
// src/screens/admin/AdminReportsScreen.tsx
//
// v2 (28/09):
// - "Este mês" ao vivo (getAdminDashboard) e os acumulados.
// - Relatórios ESCRITOS dos meses fechados (adminReports), gerados no
//   fechamento do dia 1 — toque para ler, texto selecionável.
// - Sai o que ninguém gravava (downloads, pendentes manuais, "Receita
//   total" que na verdade era a do mês).
// ============================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { useAdminDashboard } from '../../hooks/useAdminDashboard';
import { getAdminReports, AdminReport } from '../../services/marketplace/adminService';
import { formatBRL } from '../../services/marketplace/adminDashboardService';
import ScreenContainer from '../../components/ScreenContainer';

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? colors.success : tone === 'bad' ? colors.error : colors.white;
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function AdminReportsScreen() {
  const navigation = useNavigation();
  const { blocked, loading: guardLoading } = useAdminGuard();
  const { data, loading, refreshing, refresh } = useAdminDashboard(!blocked && !guardLoading);

  const [reports, setReports]         = useState<AdminReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError]     = useState<string | null>(null);
  const [open, setOpen]               = useState<AdminReport | null>(null);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      setReports(await getAdminReports());
    } catch (e: unknown) {
      setReportsError(e instanceof Error ? e.message : 'Erro ao carregar relatórios.');
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  if (guardLoading || blocked) return null;

  const m = data?.metrics;
  const net = m ? m.monthlyRevenue - m.monthlyRefundedAmount : 0;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Relatórios</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { refresh(); loadReports(); }}
            tintColor={colors.gold}
          />
        }
      >
        {loading && !m ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
        ) : m ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>Receita bruta · este mês (parcial)</Text>
              <Text style={styles.heroValue}>{formatBRL(m.monthlyRevenue)}</Text>
              <Text style={styles.heroSub}>Líquida (− reembolsos): {formatBRL(net)}</Text>
            </View>

            <Text style={styles.sectionTitle}>Este mês</Text>
            <View style={styles.grid}>
              <Stat label="Cristais e Galáxia"     value={formatBRL(m.monthlyCoinsRevenue)} tone="good" />
              <Stat label="Marketplace"            value={formatBRL(m.monthlyMarketplaceRevenue)} tone="good" />
              <Stat label="Comissão"               value={formatBRL(m.monthlyCommission)} />
              <Stat label="Reembolsado"            value={`${formatBRL(m.monthlyRefundedAmount)} (${m.monthlyRefundsApproved})`} tone={m.monthlyRefundedAmount > 0 ? 'bad' : undefined} />
              <Stat label="Pedidos de reembolso"   value={m.refundRequestsMonth} />
              <Stat label="Estornos pelo banco"    value={m.monthlyChargebacks} tone={m.monthlyChargebacks > 0 ? 'bad' : undefined} />
              <Stat label="Vendas de cristais"     value={m.monthlyCoinsSales} />
              <Stat label="Vendas marketplace"     value={m.monthlyMarketplaceSales} />
            </View>

            <Text style={styles.sectionTitle}>Acumulado</Text>
            <View style={styles.grid}>
              <Stat label="Total de vendas"          value={m.totalSales} />
              <Stat label="Receita total (comissão)" value={formatBRL(m.totalCommission)} />
              <Stat label="Pago a criadores"         value={formatBRL(m.totalWithdrawn)} />
              <Stat label="Criadores · produtos"     value={`${m.creators} · ${m.activeProducts}`} />
            </View>

            {m.updatedAt ? (
              <Text style={styles.updatedAt}>Atualizado em {new Date(m.updatedAt).toLocaleString('pt-BR')}</Text>
            ) : null}
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Meses fechados</Text>
        {reportsLoading ? (
          <ActivityIndicator color={colors.gold} />
        ) : reportsError ? (
          <TouchableOpacity onPress={loadReports}>
            <Text style={styles.errorText}>⚠️ {reportsError} Toque para tentar de novo.</Text>
          </TouchableOpacity>
        ) : reports.length === 0 ? (
          <Text style={styles.emptyText}>
            O primeiro relatório aparece aqui no dia 1 do próximo mês, logo depois do fechamento.
          </Text>
        ) : (
          reports.map(r => (
            <TouchableOpacity key={r.id} style={styles.reportRow} onPress={() => setOpen(r)} accessibilityRole="button">
              <View style={{ flex: 1 }}>
                <Text style={styles.reportTitle}>{r.label.charAt(0).toUpperCase() + r.label.slice(1)}</Text>
                <Text style={styles.reportSub}>Bruta {formatBRL(r.grossRevenue)} · líquida {formatBRL(r.netRevenue)}</Text>
              </View>
              <Text style={styles.reportArrow}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={open !== null} animationType="slide" onRequestClose={() => setOpen(null)}>
        <ScreenContainer>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setOpen(null)} accessibilityRole="button" accessibilityLabel="Fechar">
              <Text style={styles.backBtn}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Relatório</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.reportText} selectable>{open?.text}</Text>
          </ScrollView>
        </ScreenContainer>
      </Modal>
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
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  hero: {
    backgroundColor: colors.gold + '11', borderRadius: borderRadius.lg, borderWidth: 1,
    borderColor: colors.gold + '44', padding: spacing.lg, alignItems: 'center',
  },
  heroLabel: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold', textAlign: 'center' },
  heroValue: { color: colors.white, fontSize: 32, fontWeight: 'bold', marginVertical: spacing.xs },
  heroSub: { color: colors.gray, fontSize: fonts.sizes.sm },
  sectionTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', marginTop: spacing.lg, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, flexGrow: 1, flexBasis: '45%', minWidth: '45%',
  },
  statLabel: { color: colors.gray, fontSize: fonts.sizes.xs },
  statValue: { fontSize: fonts.sizes.md, fontWeight: 'bold', marginTop: 2 },
  updatedAt: { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: spacing.md, textAlign: 'center' },
  errorText: { color: colors.error, fontSize: fonts.sizes.sm, textAlign: 'center' },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.sm, lineHeight: 20 },
  reportRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.sm,
  },
  reportTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  reportSub: { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: 2 },
  reportArrow: { color: colors.gold, fontSize: fonts.sizes.xl },
  reportText: { color: colors.white, fontSize: fonts.sizes.md, lineHeight: 24 },
});
// ============================================
// LUMINA — PAINEL ADMIN v2
// src/screens/admin/AdminDashboardScreen.tsx
//
// v2 (28/09):
// - Balão em cada área com pendência (contado no servidor, nunca
//   contador manual).
// - Rodapé só com números de negócio.
// - Puxar para atualizar recarrega de verdade (antes era um
//   setTimeout de 1s sem buscar nada).
// ============================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { useAdminDashboard } from '../../hooks/useAdminDashboard';
import { formatBRL } from '../../services/marketplace/adminDashboardService';
import AdminLoadingScreen from './AdminLoadingScreen';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type Route = keyof RootStackParamList;

let _adminSessionReady = false;

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

function MenuCard({
  icon, label, count = 0, onPress,
}: { icon: string; label: string; count?: number; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.menuCard, count > 0 && styles.menuCardAlert]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${label}, ${count} pendentes` : label}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <Badge count={count} />
    </TouchableOpacity>
  );
}

function MetricCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function AdminDashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { isSuperAdmin } = useUserPermissions(user?.uid);
  const { blocked, loading: guardLoading } = useAdminGuard();
  const [adminReady, setAdminReady] = useState(_adminSessionReady);

  const { data, loading, refreshing, error, refresh } = useAdminDashboard(!blocked && !guardLoading);

  const go = (route: Route) => () => navigation.navigate(route as never);

  if (guardLoading || blocked) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      </ScreenContainer>
    );
  }

  if (!adminReady) {
    return (
      <AdminLoadingScreen
        onFinish={() => { _adminSessionReady = true; setAdminReady(true); }}
      />
    );
  }

  const p = data?.pending;
  const m = data?.metrics;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Painel Admin</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{isSuperAdmin ? '👑 Super' : '🔑 Admin'}</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold} />}
        contentContainerStyle={styles.content}
      >
        {data && data.totalPending > 0 && (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingBannerText}>
              {data.totalPending === 1 ? '1 item aguarda você' : `${data.totalPending} itens aguardam você`}
            </Text>
          </View>
        )}

        {error && !data && (
          <TouchableOpacity style={styles.errorBox} onPress={refresh} accessibilityRole="button">
            <Text style={styles.errorText}>⚠️ {error} Toque para tentar de novo.</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Moderação</Text>
        <View style={styles.menuGrid}>
          <MenuCard icon="👤" label="Criadores" count={p?.creatorRequests} onPress={go('AdminCreatorRequests')} />
          <MenuCard icon="📦" label="Produtos"  count={p?.products}        onPress={go('AdminProductsModeration')} />
          <MenuCard icon="🚨" label="Fraudes"   count={p?.fraud}           onPress={go('AdminFraudFlags')} />
          <MenuCard icon="🔍" label="Usuários"                              onPress={go('AdminUserSearch')} />
          <MenuCard icon="🆘" label="Suporte"   count={p?.support}         onPress={go('AdminSupport')} />
          {isSuperAdmin && (
            <MenuCard icon="🪪" label="Idade" count={p?.ageVerifications} onPress={go('AdminAgeVerification')} />
          )}
          {isSuperAdmin && <MenuCard icon="🔒" label="Bloqueados" onPress={go('AdminBlockedUsers')} />}
          {isSuperAdmin && <MenuCard icon="✦"  label="Vitrine"    onPress={go('AdminCuration')} />}
        </View>

        <Text style={styles.sectionTitle}>Financeiro</Text>
        <View style={styles.menuGrid}>
          <MenuCard icon="💳" label="Vendas" onPress={go('AdminSales')} />
          {isSuperAdmin && (
            <MenuCard icon="↩️" label="Reembolsos" count={p?.refunds} onPress={go('AdminRefundRequests')} />
          )}
          {isSuperAdmin && (
            <MenuCard icon="💸" label="Saques" count={p?.withdrawals} onPress={go('AdminWithdrawals')} />
          )}
          <MenuCard icon="📊" label="Relatórios" onPress={go('AdminReports')} />
          {isSuperAdmin && <MenuCard icon="📈" label="Economia" onPress={go('AdminInflation')} />}
        </View>

        <Text style={styles.sectionTitle}>Configurações</Text>
        <View style={styles.menuGrid}>
          <MenuCard icon="🎟️" label="Cupons" onPress={go('AdminCoupons')} />
        </View>

        <Text style={styles.sectionTitle}>Negócio</Text>
        {loading && !data ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.md }} />
        ) : m ? (
          <View style={styles.metricsGrid}>
            <MetricCard icon="💰" label="Total de vendas"            value={m.totalSales} />
            <MetricCard icon="🛍️" label="Vendas marketplace · mês"  value={m.monthlyMarketplaceSales} />
            <MetricCard icon="💎" label="Vendas de cristais · mês"   value={m.monthlyCoinsSales} />
            <MetricCard icon="↩️" label="Pedidos de reembolso · mês" value={m.refundRequestsMonth} />
            {isSuperAdmin && (
              <>
                <MetricCard icon="📈" label="Receita bruta · mês"   value={formatBRL(m.monthlyRevenue)} />
                <MetricCard icon="💵" label="Receita total (comissão)" value={formatBRL(m.totalCommission)} />
                <MetricCard icon="📅" label="Comissão · mês"        value={formatBRL(m.monthlyCommission)} />
                <MetricCard icon="💸" label="Pago a criadores"      value={formatBRL(m.totalWithdrawn)} />
              </>
            )}
            <MetricCard icon="👥" label="Criadores"       value={m.creators} />
            <MetricCard icon="📦" label="Produtos ativos" value={m.activeProducts} />
          </View>
        ) : null}
      </ScrollView>
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
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  roleBadge: {
    backgroundColor: colors.gold + '22', borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.gold, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2,
  },
  roleBadgeText: { color: colors.gold, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  pendingBanner: {
    backgroundColor: colors.error + '18', borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.error + '66', padding: spacing.sm, alignItems: 'center',
  },
  pendingBannerText: { color: colors.error, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  errorBox: {
    marginTop: spacing.sm, padding: spacing.sm, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.error + '66',
  },
  errorText: { color: colors.error, fontSize: fonts.sizes.xs, textAlign: 'center' },
  sectionTitle: {
    color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold',
    marginTop: spacing.md, marginBottom: spacing.sm,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  menuCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, width: '47%', alignItems: 'center', gap: spacing.xs,
  },
  menuCardAlert: { borderColor: colors.error + '88' },
  menuIcon: { fontSize: 28 },
  menuLabel: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  badge: {
    position: 'absolute', top: 8, right: 8,
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: 'bold' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, width: '47%', alignItems: 'center',
  },
  metricIcon: { fontSize: 20, marginBottom: spacing.xs },
  metricValue: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  metricLabel: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },
});
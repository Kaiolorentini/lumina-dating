import React, { useEffect, useState } from 'react';
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
import { listenToAdminMetrics } from '../../services/marketplace/adminService';
import { AdminMetrics } from '../../shared/types/marketplace';
import AdminLoadingScreen from './AdminLoadingScreen';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface MetricCardProps {
  icon: string;
  label: string;
  value: string | number;
  onPress?: () => void;
  highlight?: boolean;
  superAdminOnly?: boolean;
  isSuperAdmin?: boolean;
}

function MetricCard({ icon, label, value, onPress, highlight, superAdminOnly, isSuperAdmin }: MetricCardProps) {
  if (superAdminOnly && !isSuperAdmin) return null;
  return (
    <TouchableOpacity
      style={[styles.metricCard, highlight && styles.metricCardHighlight]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.8 : 1}
    >
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {onPress && <Text style={styles.metricArrow}>›</Text>}
    </TouchableOpacity>
  );
}

let _adminSessionReady = false;

export default function AdminDashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { isSuperAdmin } = useUserPermissions(user?.uid);
  const { blocked, loading: guardLoading } = useAdminGuard();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [adminReady, setAdminReady] = useState(_adminSessionReady);

  useEffect(() => {
    const unsub = listenToAdminMetrics(setMetrics);
    return unsub;
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  function handleAdminReady() {
    _adminSessionReady = true;
    setAdminReady(true);
  }

  if (guardLoading || blocked) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      </ScreenContainer>
    );
  }

  if (!adminReady) {
    return <AdminLoadingScreen onFinish={handleAdminReady} />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Painel Admin</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {isSuperAdmin ? '👑 Super' : '🔑 Admin'}
          </Text>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />
        }
        contentContainerStyle={styles.content}
      >
        <Text style={styles.sectionTitle}>Moderação</Text>
        <View style={styles.menuGrid}>
          <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('AdminCreatorRequests')}>
            <Text style={styles.menuIcon}>👤</Text>
            <Text style={styles.menuLabel}>Criadores</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('AdminProductsModeration')}>
            <Text style={styles.menuIcon}>📦</Text>
            <Text style={styles.menuLabel}>Produtos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('AdminFraudFlags')}>
            <Text style={styles.menuIcon}>🚨</Text>
            <Text style={styles.menuLabel}>Fraudes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('AdminUserSearch')}>
            <Text style={styles.menuIcon}>🔍</Text>
            <Text style={styles.menuLabel}>Usuários</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Financeiro</Text>
        <View style={styles.menuGrid}>
          <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('AdminSales')}>
            <Text style={styles.menuIcon}>💳</Text>
            <Text style={styles.menuLabel}>Vendas</Text>
          </TouchableOpacity>
          {isSuperAdmin && (
            <>
              <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('AdminRefundRequests')}>
                <Text style={styles.menuIcon}>↩️</Text>
                <Text style={styles.menuLabel}>Reembolsos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('AdminWithdrawals')}>
                <Text style={styles.menuIcon}>💸</Text>
                <Text style={styles.menuLabel}>Saques</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('AdminReports')}>
            <Text style={styles.menuIcon}>📊</Text>
            <Text style={styles.menuLabel}>Relatórios</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Configurações</Text>
        <View style={styles.menuGrid}>
          <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('AdminCoupons')}>
            <Text style={styles.menuIcon}>🎟️</Text>
            <Text style={styles.menuLabel}>Cupons</Text>
          </TouchableOpacity>
        </View>

        {metrics && (
          <>
            <Text style={styles.sectionTitle}>Métricas</Text>
            <View style={styles.metricsGrid}>
              <MetricCard icon="💰" label="Total vendas" value={metrics.totalSales} />
              <MetricCard icon="👥" label="Criadores" value={metrics.totalCreators} />
              <MetricCard icon="📦" label="Produtos" value={metrics.totalProducts} />
              <MetricCard icon="⏳" label="Pendentes" value={metrics.pendingProducts} highlight />
              <MetricCard icon="💸" label="Saques pendentes" value={metrics.pendingWithdrawals} highlight />
              <MetricCard
                icon="💵" label="Receita total"
                value={`R$ ${metrics.totalCommission?.toFixed(2) ?? '0.00'}`}
                superAdminOnly isSuperAdmin={isSuperAdmin}
              />
              <MetricCard
                icon="📅" label="Receita mês"
                value={`R$ ${metrics.monthlyCommission?.toFixed(2) ?? '0.00'}`}
                superAdminOnly isSuperAdmin={isSuperAdmin}
              />
              <MetricCard
                icon="↩️" label="Reembolsos"
                value={metrics.totalRefunds ?? 0}
                superAdminOnly isSuperAdmin={isSuperAdmin}
              />
            </View>
          </>
        )}
      </ScrollView>
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
  roleBadge: {
    backgroundColor: colors.gold + '22', borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.gold, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2,
  },
  roleBadgeText: { color: colors.gold, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  content: { padding: spacing.md },
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
  menuIcon: { fontSize: 28 },
  menuLabel: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, width: '47%', alignItems: 'center',
  },
  metricCardHighlight: { borderColor: colors.gold + '88' },
  metricIcon: { fontSize: 20, marginBottom: spacing.xs },
  metricValue: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  metricLabel: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },
  metricArrow: { color: colors.gold, fontSize: fonts.sizes.lg, position: 'absolute', right: spacing.sm, top: spacing.sm },
});
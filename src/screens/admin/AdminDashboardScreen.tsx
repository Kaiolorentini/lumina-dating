import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Input } from '../../components/ui';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';
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
        <ActivityIndicator color={COLORS.gold} style={{ flex: 1 }} />
      </ScreenContainer>
    );
  }

  if (!adminReady) {
    return <AdminLoadingScreen onFinish={handleAdminReady} />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Painel Admin</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {isSuperAdmin ? '👑 Super' : '🔑 Admin'}
          </Text>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.gold} />
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.gold + '44',
  },
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  roleBadge: {
    backgroundColor: COLORS.gold + '22', borderRadius: BORDER_RADIUS.full,
    borderWidth: 1, borderColor: COLORS.gold, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs / 2,
  },
  roleBadgeText: { color: COLORS.gold, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  content: { padding: SPACING.md },
  sectionTitle: {
    color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold,
    marginTop: SPACING.md, marginBottom: SPACING.sm,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  menuCard: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.md, width: '47%', alignItems: 'center', gap: SPACING.xs,
  },
  menuIcon: { fontSize: FONT_SIZE.hero },
  menuLabel: { color: COLORS.textPrimary, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  metricCard: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.md, width: '47%', alignItems: 'center',
  },
  metricCardHighlight: { borderColor: COLORS.gold + '88' },
  metricIcon: { fontSize: FONT_SIZE.title, marginBottom: SPACING.xs },
  metricValue: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  metricLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, textAlign: 'center' },
  metricArrow: { color: COLORS.gold, fontSize: FONT_SIZE.subtitle, position: 'absolute', right: SPACING.sm, top: SPACING.sm },
});

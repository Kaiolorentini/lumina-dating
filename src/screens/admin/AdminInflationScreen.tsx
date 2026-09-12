// ============================================
// LUMINA — ADMIN INFLATION SCREEN
// src/screens/admin/AdminInflationScreen.tsx
//
// Painel de saúde da economia de cristais.
// Acesso restrito a superadmin (validado na CF).
//
// Meta de ratio (gasto/criado): 0.7 – 0.9
//   < 0.5  → CRÍTICO  (cristais acumulando, inflação)
//   < 0.7  → ATENÇÃO
//   0.7-0.9→ SAUDÁVEL
//   > 1.0  → deflação (gastam mais do que ganham)
// ============================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const functions = getFunctions();

interface Snapshot {
  date:                     string;
  cristaisCreatedGratuitos: number;
  cristaisCreatedPremium:   number;
  cristaisSpent:            number;
  cristaisPurchased:        number;
  netFlow:                  number;
  ratioSpentToCreated:      number;
  activeUsers:              number;
  totalTransactions:        number;
  newWallets:               number;
  topSources:               Record<string, number>;
  topSinks:                 Record<string, number>;
  alertSent:                boolean;
}

interface SnapshotsResponse {
  snapshots: Snapshot[];
  totals: {
    created:   number;
    spent:     number;
    purchased: number;
    newUsers:  number;
    ratio:     number;
  };
  health:     'HEALTHY' | 'WARNING' | 'CRITICAL';
  alertCount: number;
}

const HEALTH_CONFIG = {
  HEALTHY:  { icon: '🟢', label: 'Saudável', color: '#44FF88',
              msg: 'A economia está equilibrada. Cristais circulam bem.' },
  WARNING:  { icon: '🟡', label: 'Atenção',  color: '#FFD700',
              msg: 'Cristais começando a acumular. Considere novos gastos ou revisar recompensas.' },
  CRITICAL: { icon: '🔴', label: 'Crítico',  color: '#FF6B6B',
              msg: 'Inflação detectada. Usuários acumulam sem gastar — o cristal está perdendo valor.' },
} as const;

// Rótulos legíveis para os tipos do auditLog
const TIPO_LABELS: Record<string, string> = {
  LOGIN_DIARIO:            '🎁 Recompensa diária',
  FAISCA_DESTINO:          '⚡ Faísca do Destino',
  MISSAO_COMPLETA:         '📋 Missões',
  CONQUISTA:               '🏆 Conquistas',
  COFRE_SAQUE:             '🗝️ Cofre',
  FRAGMENTOS_CONVERSAO:    '🔮 Conversão',
  WELCOME_BONUS:           '👋 Bônus de boas-vindas',
  PRESTIGIO_BONUS:         '👑 Prestígio',
  COMPRA_ASAAS:            '💳 Compra (Asaas)',
  GALAXIA_PLUS_MENSAL:     '💜 Galáxia Plus',
  FIRST_PURCHASE_BONUS:    '🎁 Bônus 1ª compra',
  SPEND_REVEAL_VISITORS:   '👁️ Ver Visitantes',
  SPEND_QUASE_SINTONIA:    '💜 Quase Sintonia',
  SPEND_SINTONIA_PERDIDA:  '💔 Sintonia Perdida',
  SPEND_MYSTERY_MATCH:     '🎭 Sintonia Misteriosa',
  SPEND_PENSOU_EM_VOCE:    '✨ Pensou em Você',
  SPEND_IMPULSO_PERFIL:    '🚀 Impulso de Perfil',
  SPEND_DESTAQUE_REGIONAL: '📍 Destaque Regional',
  SPEND_MEGA_DESTAQUE:     '🌟 Mega Destaque',
  SPEND_TURBO_SINTONIA:    '⚡ Turbo Sintonia',
  SPEND_PERFIL_GALAXIA:    '🌌 Perfil Galáxia',
  SPEND_SEGUNDA_CHANCE:    '🔄 Segunda Chance',
  SPEND_ENERGIA:           '🔋 Energia',
  SPEND_FERTILIZANTE:      '🌱 Fertilizante',
  SPEND_MERCADO_COSMICO:   '🛒 Mercado Cósmico',
  ADMIN_AJUSTE:            '🔧 Ajuste manual',
  ESTORNO:                 '↩️ Estorno',
};

function labelFor(tipo: string): string {
  return TIPO_LABELS[tipo] ?? tipo;
}

function StatCard({ icon, label, value, color }: {
  icon: string; label: string; value: string | number; color?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BreakdownList({ title, data, positive }: {
  title: string; data: Record<string, number>; positive: boolean;
}) {
  const entries = Object.entries(data ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (entries.length === 0) return null;

  const max = entries[0][1];

  return (
    <View style={styles.breakdownCard}>
      <Text style={styles.breakdownTitle}>{title}</Text>
      {entries.map(([tipo, valor]) => (
        <View key={tipo} style={styles.breakdownRow}>
          <View style={styles.breakdownInfo}>
            <Text style={styles.breakdownLabel} numberOfLines={1}>{labelFor(tipo)}</Text>
            <View style={styles.breakdownBarBg}>
              <View style={[
                styles.breakdownBarFill,
                {
                  width: `${(valor / max) * 100}%` as any,
                  backgroundColor: positive ? '#44FF88' : colors.gold,
                },
              ]} />
            </View>
          </View>
          <Text style={[
            styles.breakdownValue,
            { color: positive ? '#44FF88' : colors.gold },
          ]}>
            {positive ? '+' : '-'}{valor.toLocaleString('pt-BR')}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function AdminInflationScreen() {
  const navigation = useNavigation<NavProp>();
  const { blocked, loading: guardLoading } = useAdminGuard();

  const [data,       setData]       = useState<SnapshotsResponse | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [period,     setPeriod]     = useState<7 | 30 | 90>(30);

  const load = useCallback(async (days: number) => {
    setError(null);
    try {
      const fn = httpsCallable<{ days: number }, SnapshotsResponse>(
        functions, 'getEconomySnapshots'
      );
      const result = await fn({ days });
      setData(result.data);
    } catch (err) {
      console.error('[AdminInflation] error:', err);
      setError('Não foi possível carregar os dados da economia.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  function handleRefresh() {
    setRefreshing(true);
    load(period);
  }

  function handlePeriodChange(days: 7 | 30 | 90) {
    setPeriod(days);
    setLoading(true);
  }

  if (guardLoading || blocked) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      </ScreenContainer>
    );
  }

  const health   = data ? HEALTH_CONFIG[data.health] : null;
  const snapshots = data?.snapshots ?? [];

  // Agrega breakdown de todo o período
  const aggSources: Record<string, number> = {};
  const aggSinks:   Record<string, number> = {};
  snapshots.forEach(s => {
    Object.entries(s.topSources ?? {}).forEach(([k, v]) => {
      aggSources[k] = (aggSources[k] ?? 0) + v;
    });
    Object.entries(s.topSinks ?? {}).forEach(([k, v]) => {
      aggSinks[k] = (aggSinks[k] ?? 0) + v;
    });
  });

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Economia</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>👑 Super</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Seletor de período */}
        <View style={styles.periodRow}>
          {([7, 30, 90] as const).map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.periodBtn, period === d && styles.periodBtnActive]}
              onPress={() => handlePeriodChange(d)}
            >
              <Text style={[styles.periodText, period === d && styles.periodTextActive]}>
                {d} dias
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.gold} size="large" />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => load(period)}>
              <Text style={styles.retryBtnText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : snapshots.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>Sem dados ainda</Text>
            <Text style={styles.emptySub}>
              O primeiro snapshot é gerado às 23:55 de hoje.
            </Text>
          </View>
        ) : (
          <>
            {/* Saúde da economia */}
            {health && (
              <View style={[styles.healthCard, { borderColor: health.color + '66' }]}>
                <View style={styles.healthHeader}>
                  <Text style={styles.healthIcon}>{health.icon}</Text>
                  <View style={styles.healthInfo}>
                    <Text style={[styles.healthLabel, { color: health.color }]}>
                      {health.label}
                    </Text>
                    <Text style={styles.healthRatio}>
                      Ratio gasto/criado: {data!.totals.ratio.toFixed(2)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.healthMsg}>{health.msg}</Text>
                <View style={styles.healthMeta}>
                  <Text style={styles.healthMetaText}>Meta: 0.70 – 0.90</Text>
                  {data!.alertCount > 0 && (
                    <Text style={styles.healthAlerts}>
                      ⚠️ {data!.alertCount} alerta(s) no período
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Totais do período */}
            <Text style={styles.sectionTitle}>Totais do período</Text>
            <View style={styles.statsGrid}>
              <StatCard icon="✨" label="Cristais criados"
                value={data!.totals.created.toLocaleString('pt-BR')} />
              <StatCard icon="🔥" label="Cristais gastos"
                value={data!.totals.spent.toLocaleString('pt-BR')} color={colors.gold} />
              <StatCard icon="💳" label="Comprados"
                value={data!.totals.purchased.toLocaleString('pt-BR')} color="#FFD700" />
              <StatCard icon="👤" label="Novas carteiras"
                value={data!.totals.newUsers.toLocaleString('pt-BR')} />
            </View>

            {/* Breakdown */}
            <Text style={styles.sectionTitle}>De onde vêm os cristais</Text>
            <BreakdownList title="Entradas" data={aggSources} positive />

            <Text style={styles.sectionTitle}>Para onde vão os cristais</Text>
            <BreakdownList title="Saídas" data={aggSinks} positive={false} />

            {/* Histórico diário */}
            <Text style={styles.sectionTitle}>Histórico diário</Text>
            <View style={styles.historyCard}>
              <View style={styles.historyHeaderRow}>
                <Text style={[styles.historyHeaderCell, { flex: 1.4 }]}>Data</Text>
                <Text style={styles.historyHeaderCell}>Criado</Text>
                <Text style={styles.historyHeaderCell}>Gasto</Text>
                <Text style={styles.historyHeaderCell}>Ratio</Text>
              </View>
              {snapshots.map(s => {
                const created = s.cristaisCreatedGratuitos + s.cristaisCreatedPremium;
                const ratioColor =
                  s.ratioSpentToCreated < 0.5 ? '#FF6B6B'
                  : s.ratioSpentToCreated < 0.7 ? '#FFD700'
                  : '#44FF88';
                return (
                  <View key={s.date} style={styles.historyRow}>
                    <Text style={[styles.historyCell, { flex: 1.4 }]}>
                      {s.date.slice(5).split('-').reverse().join('/')}
                      {s.alertSent ? ' ⚠️' : ''}
                    </Text>
                    <Text style={styles.historyCell}>{created}</Text>
                    <Text style={styles.historyCell}>{s.cristaisSpent}</Text>
                    <Text style={[styles.historyCell, { color: ratioColor, fontWeight: 'bold' }]}>
                      {s.ratioSpentToCreated.toFixed(2)}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Como ler */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>ℹ️ Como interpretar</Text>
              <Text style={styles.infoText}>
                • <Text style={styles.infoBold}>Ratio</Text> = cristais gastos ÷ cristais criados
              </Text>
              <Text style={styles.infoText}>
                • Abaixo de 0.70 os usuários acumulam sem gastar — o cristal perde valor
              </Text>
              <Text style={styles.infoText}>
                • Acima de 0.90 pode faltar cristal e frustrar quem não compra
              </Text>
              <Text style={styles.infoText}>
                • Fragmentos não entram aqui — são economia separada
              </Text>
              <Text style={styles.infoText}>
                • Snapshot roda automaticamente às 23:55 (horário de Brasília)
              </Text>
            </View>
          </>
        )}
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
  backBtn:       { color: colors.gold, fontSize: 28 },
  headerTitle:   { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  roleBadge: {
    backgroundColor: colors.gold + '22', borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.gold,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2,
  },
  roleBadgeText: { color: colors.gold, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  content:       { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  center:        { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: spacing.md },
  errorText:     { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.xl,
  },
  retryBtnText:  { color: colors.background, fontWeight: 'bold' },
  emptyIcon:     { fontSize: 56 },
  emptyTitle:    { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  emptySub:      { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center' },

  // Período
  periodRow:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  periodBtn: {
    flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark,
  },
  periodBtnActive: { borderColor: colors.gold, backgroundColor: colors.gold + '22' },
  periodText:      { color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  periodTextActive:{ color: colors.gold },

  // Saúde
  healthCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.sm,
  },
  healthHeader:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  healthIcon:    { fontSize: 32 },
  healthInfo:    { flex: 1 },
  healthLabel:   { fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  healthRatio:   { color: colors.gray, fontSize: fonts.sizes.sm, marginTop: 2 },
  healthMsg:     { color: colors.grayLight, fontSize: fonts.sizes.sm, lineHeight: 20 },
  healthMeta:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healthMetaText:{ color: colors.gray, fontSize: fonts.sizes.xs },
  healthAlerts:  { color: '#FFD700', fontSize: fonts.sizes.xs, fontWeight: 'bold' },

  sectionTitle: {
    color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold',
    marginTop: spacing.md, marginBottom: spacing.sm,
    textTransform: 'uppercase', letterSpacing: 1,
  },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.md, width: '47%', alignItems: 'center',
  },
  statIcon:  { fontSize: 20, marginBottom: spacing.xs },
  statValue: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  statLabel: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },

  // Breakdown
  breakdownCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.md, gap: spacing.sm,
  },
  breakdownTitle:  { color: colors.gray, fontSize: fonts.sizes.xs, textTransform: 'uppercase', letterSpacing: 1 },
  breakdownRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  breakdownInfo:   { flex: 1, gap: 4 },
  breakdownLabel:  { color: colors.white, fontSize: fonts.sizes.sm },
  breakdownBarBg:  { height: 4, backgroundColor: colors.grayDark, borderRadius: 2, overflow: 'hidden' },
  breakdownBarFill:{ height: '100%', borderRadius: 2 },
  breakdownValue:  { fontSize: fonts.sizes.sm, fontWeight: 'bold', minWidth: 70, textAlign: 'right' },

  // Histórico
  historyCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark, overflow: 'hidden',
  },
  historyHeaderRow: {
    flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.grayDark,
  },
  historyHeaderCell: {
    flex: 1, color: colors.gray, fontSize: fonts.sizes.xs,
    fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'right',
  },
  historyRow: {
    flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.grayDark,
  },
  historyCell: { flex: 1, color: colors.grayLight, fontSize: fonts.sizes.sm, textAlign: 'right' },

  // Info
  infoCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.md, gap: spacing.xs, marginTop: spacing.md,
  },
  infoTitle: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold', marginBottom: spacing.xs },
  infoText:  { color: colors.gray, fontSize: fonts.sizes.xs, lineHeight: 18 },
  infoBold:  { color: colors.white, fontWeight: 'bold' },
});
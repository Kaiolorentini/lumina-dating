// ============================================
// LUMINA — ECONOMIA (ADMIN) v2
// src/screens/admin/AdminInflationScreen.tsx
//
// v2 (28/09): a economia inteira.
// - Cristais com compra × recompensa × gasto × estorno (a v1 via só
//   uma fração: diária, Faísca, Galáxia Plus, Turbo, Carta, árvore e
//   níveis não eram registrados).
// - Fragmentos, impulsos e Galáxia Plus — antes fora da tela.
// - CrystalIcon no lugar do ✨.
// - getFunctions() na chamada, não no carregamento do arquivo.
//
// Meta de ratio (gasto/criado): 0.7 – 0.9
// ============================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { CrystalIcon } from '../../components/icons/CrystalIcon';
import ScreenContainer from '../../components/ScreenContainer';

interface Snapshot {
  date:                     string;
  cristaisCreatedGratuitos: number;
  cristaisCreatedPremium:   number;
  cristaisSpent:            number;
  ratioSpentToCreated:      number;
  topSources?:              Record<string, number>;
  topSinks?:                Record<string, number>;
  fragmentos?: {
    gerados: number; convertidos: number; gastos: number;
    topSources?: Record<string, number>; topSinks?: Record<string, number>;
  };
  alertSent?:               boolean;
}

interface SnapshotsResponse {
  snapshots: Snapshot[];
  totals: {
    created: number; spent: number; purchased: number; refunded: number;
    newUsers: number; ratio: number;
    fragments: { gerados: number; convertidos: number; gastos: number };
    impulsos: Record<string, { total: number; assinatura: number }>;
    galaxiaAtivacoes: number;
  };
  health:            'HEALTHY' | 'WARNING' | 'CRITICAL';
  alertCount:        number;
  activeSubscribers: number;
}

const HEALTH_CONFIG = {
  HEALTHY:  { icon: '🟢', label: 'Saudável', color: '#44FF88',
              msg: 'A economia está equilibrada. Os cristais circulam bem.' },
  WARNING:  { icon: '🟡', label: 'Atenção',  color: '#FFD700',
              msg: 'Cristais começando a acumular. Considere novos gastos ou revisar recompensas.' },
  CRITICAL: { icon: '🔴', label: 'Crítico',  color: '#FF6B6B',
              msg: 'Inflação: usuários acumulam sem gastar e o cristal perde valor.' },
} as const;

// Nomes legíveis — os atuais e os de registros antigos.
const TIPO_LABELS: Record<string, string> = {
  // Cristais — entradas
  COMPRA_ASAAS:                  '💳 Pacotes de cristais',
  GALAXIA_PLUS_ATIVACAO:         '💜 Galáxia Plus',
  WELCOME_BONUS:                 '👋 Boas-vindas',
  LOGIN_DIARIO:                  '🎁 Recompensa diária',
  FAISCA_DESTINO:                '⚡ Faísca do Destino',
  MISSAO_ESPECIAL:               '📋 Missão especial',
  ARVORE_RECOMPENSA:             '🌳 Árvore',
  NIVEL_RECOMPENSA:              '⬆️ Níveis',
  FRAGMENTOS_CONVERSAO:          '🔮 Conversão de fragmentos',
  CARTA_DESTINO_ESTORNO:         '↩️ Devolução da Carta',
  // Cristais — saídas
  SPEND_COSMETICO:               '🖼️ Molduras e badges',
  SPEND_REVEAL_VISITORS:         '👁️ Ver Visitantes',
  SPEND_REVEAL_QUASE_SINTONIA:   '💜 Quase Sintonia',
  SPEND_REVEAL_PENSOU_EM_VOCE:   '✨ Pensou em Você',
  SPEND_REVEAL_SINTONIA_PERDIDA: '💔 Sintonia Perdida',
  SPEND_IMPULSO_PERFIL:          '🚀 Impulso',
  SPEND_DESTAQUE_REGIONAL:       '📍 Destaque Regional',
  SPEND_TURBO_SINTONIA:          '⚡ Turbo',
  SPEND_FERTILIZANTE:            '🌱 Fertilizante',
  SPEND_SEGUNDA_CHANCE:          '🔄 Segunda Chance',
  SPEND_CARTA_DESTINO:           '🃏 Carta do Destino',
  ESTORNO:                       '↩️ Estorno bancário',
  ADMIN_AJUSTE:                  '🔧 Ajuste manual',
  // Fragmentos
  FRAG_MISSAO:                   '📋 Missões',
  FRAG_COFRE_DEPOSITO:           '🗝️ Cofre (visitas e curtidas)',
  FRAG_NIVEL:                    '⬆️ Níveis',
  FRAG_RANKING:                  '🏆 Ranking semanal',
  FRAG_CONQUISTA:                '🏅 Conquistas',
  FRAG_COLECAO:                  '📚 Coleções',
  FRAG_GALAXIA_PLUS:             '💜 Galáxia Plus',
  FRAG_CONVERSAO:                '💎 Convertidos em cristais',
  FRAG_BADGE:                    '🎖️ Badges',
  // Registros antigos
  MISSAO_COMPLETA:               '📋 Missões',
  CONQUISTA:                     '🏅 Conquistas',
  COFRE_SAQUE:                   '🗝️ Cofre',
  GALAXIA_PLUS_MENSAL:           '💜 Galáxia Plus',
  FIRST_PURCHASE_BONUS:          '🎁 Bônus 1ª compra',
  SPEND_QUASE_SINTONIA:          '💜 Quase Sintonia',
  SPEND_SINTONIA_PERDIDA:        '💔 Sintonia Perdida',
  SPEND_PENSOU_EM_VOCE:          '✨ Pensou em Você',
};

const IMPULSO_LABELS: Record<string, string> = {
  TURBO:             '⚡ Turbo',
  IMPULSO_PERFIL:    '🚀 Impulso',
  DESTAQUE_REGIONAL: '📍 Destaque Regional',
  FERTILIZER:        '🌱 Fertilizante',
  REVEAL_VISITORS:   '👁️ Ver Visitantes',
};

function labelFor(tipo: string): string {
  if (TIPO_LABELS[tipo]) return TIPO_LABELS[tipo];
  // Molduras/badges antigos vinham como SPEND_<item>.
  if (tipo.startsWith('SPEND_FRAME') || tipo.startsWith('SPEND_BADGE')) return '🖼️ Molduras e badges';
  return tipo;
}

function n(v: number | undefined): string {
  return (v ?? 0).toLocaleString('pt-BR');
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color?: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>{typeof icon === 'string' ? <Text style={styles.statEmoji}>{icon}</Text> : icon}</View>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BreakdownList({ title, data, positive }: {
  title: string; data: Record<string, number>; positive: boolean;
}) {
  // Agrupa tipos que viram o mesmo rótulo (nomes antigos e novos).
  const grouped: Record<string, number> = {};
  Object.entries(data ?? {}).forEach(([tipo, v]) => {
    const label = labelFor(tipo);
    grouped[label] = (grouped[label] ?? 0) + v;
  });
  const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (entries.length === 0) {
    return (
      <View style={styles.breakdownCard}>
        <Text style={styles.breakdownTitle}>{title}</Text>
        <Text style={styles.emptyLine}>Sem movimento no período.</Text>
      </View>
    );
  }
  const max = entries[0][1] || 1;
  const barColor = positive ? '#44FF88' : colors.gold;

  return (
    <View style={styles.breakdownCard}>
      <Text style={styles.breakdownTitle}>{title}</Text>
      {entries.map(([label, valor]) => (
        <View key={label} style={styles.breakdownRow}>
          <View style={styles.breakdownInfo}>
            <Text style={styles.breakdownLabel} numberOfLines={1}>{label}</Text>
            <View style={styles.breakdownBarBg}>
              <View style={[styles.breakdownBarFill, { width: `${(valor / max) * 100}%`, backgroundColor: barColor }]} />
            </View>
          </View>
          <Text style={[styles.breakdownValue, { color: barColor }]}>
            {positive ? '+' : '−'}{valor.toLocaleString('pt-BR')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function aggregate(snapshots: Snapshot[], pick: (s: Snapshot) => Record<string, number> | undefined) {
  const out: Record<string, number> = {};
  snapshots.forEach(s => {
    Object.entries(pick(s) ?? {}).forEach(([k, v]) => { out[k] = (out[k] ?? 0) + v; });
  });
  return out;
}

export default function AdminInflationScreen() {
  const navigation = useNavigation();
  const { blocked, loading: guardLoading } = useAdminGuard();

  const [data,       setData]       = useState<SnapshotsResponse | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [period,     setPeriod]     = useState<7 | 30 | 90>(30);

  const load = useCallback(async (days: number) => {
    setError(null);
    try {
      const fn = httpsCallable<{ days: number }, SnapshotsResponse>(getFunctions(), 'getEconomySnapshots');
      setData((await fn({ days })).data);
    } catch (err) {
      console.error('[AdminInflation] error:', err);
      setError('Não foi possível carregar os dados da economia.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  if (guardLoading || blocked) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      </ScreenContainer>
    );
  }

  const health    = data ? HEALTH_CONFIG[data.health] : null;
  const snapshots = data?.snapshots ?? [];
  const t         = data?.totals;

  const crystalSources = aggregate(snapshots, s => s.topSources);
  const crystalSinks   = aggregate(snapshots, s => s.topSinks);
  const fragSources    = aggregate(snapshots, s => s.fragmentos?.topSources);
  const fragSinks      = aggregate(snapshots, s => s.fragmentos?.topSinks);
  const impulsos       = Object.entries(t?.impulsos ?? {}).sort((a, b) => b[1].total - a[1].total);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Economia</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>👑 Super</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(period); }} tintColor={colors.gold} />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.periodRow}>
          {([7, 30, 90] as const).map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.periodBtn, period === d && styles.periodBtnActive]}
              onPress={() => { setPeriod(d); setLoading(true); }}
              accessibilityRole="button"
            >
              <Text style={[styles.periodText, period === d && styles.periodTextActive]}>{d} dias</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.gold} size="large" /></View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(period); }}>
              <Text style={styles.retryBtnText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : snapshots.length === 0 || !t ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>Sem dados ainda</Text>
            <Text style={styles.emptySub}>O primeiro fechamento do dia roda às 00:10 (horário de Brasília).</Text>
          </View>
        ) : (
          <>
            {health && (
              <View style={[styles.healthCard, { borderColor: health.color + '66' }]}>
                <View style={styles.healthHeader}>
                  <Text style={styles.healthIcon}>{health.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.healthLabel, { color: health.color }]}>{health.label}</Text>
                    <Text style={styles.healthRatio}>Gasto ÷ criado: {t.ratio.toFixed(2)}</Text>
                  </View>
                </View>
                <Text style={styles.healthMsg}>{health.msg}</Text>
                <View style={styles.healthMeta}>
                  <Text style={styles.healthMetaText}>Meta: 0,70 – 0,90</Text>
                  {data!.alertCount > 0 && (
                    <Text style={styles.healthAlerts}>⚠️ {data!.alertCount} alerta(s) no período</Text>
                  )}
                </View>
              </View>
            )}

            {/* ── Cristais ── */}
            <View style={styles.sectionRow}>
              <CrystalIcon size={16} />
              <Text style={styles.sectionTitle}>Cristais</Text>
            </View>
            <View style={styles.statsGrid}>
              <StatCard icon={<CrystalIcon size={22} />} label="Criados" value={n(t.created)} />
              <StatCard icon="🔥" label="Gastos" value={n(t.spent)} color={colors.gold} />
              <StatCard icon="💳" label="Comprados (pacotes e Galáxia Plus)" value={n(t.purchased)} color="#FFD700" />
              <StatCard icon="↩️" label="Estornados pelo banco" value={n(t.refunded)} color={t.refunded > 0 ? '#FF6B6B' : undefined} />
            </View>
            <BreakdownList title="De onde vêm" data={crystalSources} positive />
            <View style={{ height: spacing.sm }} />
            <BreakdownList title="Para onde vão" data={crystalSinks} positive={false} />

            {/* ── Fragmentos ── */}
            <Text style={[styles.sectionTitle, styles.sectionTitleBlock]}>🔮 Fragmentos</Text>
            <View style={styles.statsGrid}>
              <StatCard icon="🔮" label="Gerados" value={n(t.fragments.gerados)} />
              <StatCard icon={<CrystalIcon size={22} />} label="Convertidos em cristais" value={n(t.fragments.convertidos)} color={colors.gold} />
              <StatCard icon="🎖️" label="Gastos em badges" value={n(t.fragments.gastos)} color={colors.gold} />
              <StatCard
                icon="⚖️"
                label="Saíram de circulação"
                value={`${t.fragments.gerados > 0 ? Math.round(((t.fragments.convertidos + t.fragments.gastos) / t.fragments.gerados) * 100) : 0}%`}
              />
            </View>
            <BreakdownList title="De onde vêm" data={fragSources} positive />

            {Object.keys(fragSinks).length > 0 && (
              <>
                <View style={{ height: spacing.sm }} />
                <BreakdownList title="Para onde vão" data={fragSinks} positive={false} />
              </>
            )}

            {/* ── Impulsos ── */}
            <Text style={[styles.sectionTitle, styles.sectionTitleBlock]}>🚀 Impulsos ativados</Text>
            <View style={styles.breakdownCard}>
              {impulsos.length === 0 ? (
                <Text style={styles.emptyLine}>Nenhum impulso ativado no período.</Text>
              ) : impulsos.map(([key, v]) => (
                <View key={key} style={styles.impulsoRow}>
                  <Text style={styles.impulsoLabel}>{IMPULSO_LABELS[key] ?? key}</Text>
                  <Text style={styles.impulsoValue}>
                    {n(v.total)}
                    {v.assinatura > 0 ? <Text style={styles.impulsoSub}> · {n(v.assinatura)} da assinatura</Text> : null}
                  </Text>
                </View>
              ))}
            </View>

            {/* ── Galáxia Plus ── */}
            <Text style={[styles.sectionTitle, styles.sectionTitleBlock]}>💜 Galáxia Plus</Text>
            <View style={styles.statsGrid}>
              <StatCard icon="💜" label="Assinantes ativos agora" value={n(data!.activeSubscribers)} color="#C9A4F2" />
              <StatCard icon="🆕" label="Ativações e renovações no período" value={n(t.galaxiaAtivacoes)} />
            </View>

            {/* ── Base ── */}
            <Text style={[styles.sectionTitle, styles.sectionTitleBlock]}>👤 Base</Text>
            <View style={styles.statsGrid}>
              <StatCard icon="👤" label="Carteiras novas" value={n(t.newUsers)} />
            </View>

            {/* ── Histórico ── */}
            <Text style={[styles.sectionTitle, styles.sectionTitleBlock]}>Histórico diário</Text>
            <View style={styles.historyCard}>
              <View style={styles.historyHeaderRow}>
                <Text style={[styles.historyHeaderCell, { flex: 1.3, textAlign: 'left' }]}>Data</Text>
                <Text style={styles.historyHeaderCell}>Criado</Text>
                <Text style={styles.historyHeaderCell}>Gasto</Text>
                <Text style={styles.historyHeaderCell}>Frag.</Text>
                <Text style={styles.historyHeaderCell}>Ratio</Text>
              </View>
              {snapshots.map(s => {
                const created = (s.cristaisCreatedGratuitos ?? 0) + (s.cristaisCreatedPremium ?? 0);
                const r = s.ratioSpentToCreated ?? 0;
                const ratioColor = r < 0.5 ? '#FF6B6B' : r < 0.7 ? '#FFD700' : '#44FF88';
                return (
                  <View key={s.date} style={styles.historyRow}>
                    <Text style={[styles.historyCell, { flex: 1.3, textAlign: 'left' }]}>
                      {s.date.slice(5).split('-').reverse().join('/')}{s.alertSent ? ' ⚠️' : ''}
                    </Text>
                    <Text style={styles.historyCell}>{n(created)}</Text>
                    <Text style={styles.historyCell}>{n(s.cristaisSpent)}</Text>
                    <Text style={styles.historyCell}>{s.fragmentos ? n(s.fragmentos.gerados) : '—'}</Text>
                    <Text style={[styles.historyCell, { color: ratioColor, fontWeight: 'bold' }]}>{r.toFixed(2)}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>ℹ️ Como interpretar</Text>
              <Text style={styles.infoText}>• <Text style={styles.infoBold}>Ratio</Text> = cristais gastos ÷ cristais criados</Text>
              <Text style={styles.infoText}>• Abaixo de 0,70 os usuários acumulam sem gastar e o cristal perde valor</Text>
              <Text style={styles.infoText}>• Acima de 0,90 pode faltar cristal e frustrar quem não compra</Text>
              <Text style={styles.infoText}>• "Saíram de circulação" mostra quanto dos fragmentos gerados já foi convertido ou gasto</Text>
              <Text style={styles.infoText}>• Dias anteriores a 28/09 não têm fragmentos nem impulsos (aparecem com —)</Text>
              <Text style={styles.infoText}>• O dia é fechado às 00:10 (horário de Brasília)</Text>
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
    borderWidth: 1, borderColor: colors.gold, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2,
  },
  roleBadgeText: { color: colors.gold, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  content:       { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  center:        { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: spacing.md },
  errorText:     { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn:      { backgroundColor: colors.gold, borderRadius: borderRadius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  retryBtnText:  { color: colors.background, fontWeight: 'bold' },
  emptyIcon:     { fontSize: 56 },
  emptyTitle:    { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  emptySub:      { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center' },
  emptyLine:     { color: colors.gray, fontSize: fonts.sizes.sm },

  periodRow:        { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  periodBtn: {
    flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.grayDark,
  },
  periodBtnActive:  { borderColor: colors.gold, backgroundColor: colors.gold + '22' },
  periodText:       { color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  periodTextActive: { color: colors.gold },

  healthCard:     { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  healthHeader:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  healthIcon:     { fontSize: 32 },
  healthLabel:    { fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  healthRatio:    { color: colors.gray, fontSize: fonts.sizes.sm, marginTop: 2 },
  healthMsg:      { color: colors.grayLight, fontSize: fonts.sizes.sm, lineHeight: 20 },
  healthMeta:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healthMetaText: { color: colors.gray, fontSize: fonts.sizes.xs },
  healthAlerts:   { color: '#FFD700', fontSize: fonts.sizes.xs, fontWeight: 'bold' },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: {
    color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  sectionTitleBlock: { marginTop: spacing.lg, marginBottom: spacing.sm },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  statCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.md, width: '47%', alignItems: 'center',
  },
  statIcon:  { height: 26, justifyContent: 'center', marginBottom: spacing.xs },
  statEmoji: { fontSize: 20 },
  statValue: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  statLabel: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },

  breakdownCard:    { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.grayDark, padding: spacing.md, gap: spacing.sm },
  breakdownTitle:   { color: colors.gray, fontSize: fonts.sizes.xs, textTransform: 'uppercase', letterSpacing: 1 },
  breakdownRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  breakdownInfo:    { flex: 1, gap: 4 },
  breakdownLabel:   { color: colors.white, fontSize: fonts.sizes.sm },
  breakdownBarBg:   { height: 4, backgroundColor: colors.grayDark, borderRadius: 2, overflow: 'hidden' },
  breakdownBarFill: { height: '100%', borderRadius: 2 },
  breakdownValue:   { fontSize: fonts.sizes.sm, fontWeight: 'bold', minWidth: 70, textAlign: 'right' },

  impulsoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  impulsoLabel: { color: colors.white, fontSize: fonts.sizes.sm },
  impulsoValue: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  impulsoSub:   { color: colors.gray, fontSize: fonts.sizes.xs, fontWeight: 'normal' },

  historyCard:       { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.grayDark, overflow: 'hidden' },
  historyHeaderRow:  { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.grayDark },
  historyHeaderCell: { flex: 1, color: colors.gray, fontSize: fonts.sizes.xs, fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'right' },
  historyRow:        { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.grayDark },
  historyCell:       { flex: 1, color: colors.grayLight, fontSize: fonts.sizes.sm, textAlign: 'right' },

  infoCard:  { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.grayDark, padding: spacing.md, gap: spacing.xs, marginTop: spacing.lg },
  infoTitle: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold', marginBottom: spacing.xs },
  infoText:  { color: colors.gray, fontSize: fonts.sizes.xs, lineHeight: 18 },
  infoBold:  { color: colors.white, fontWeight: 'bold' },
});
// ============================================
// LUMINA — PAINEL ADMIN NO COMPUTADOR
// src/screens/admin/AdminDashboardDesktop.tsx
//
// Só no computador (AdminDashboardScreen escolhe pela useBreakpoint,
// DEPOIS do guard de admin e da tela de entrada — a segurança é a
// mesma do celular). Layout aprovado no protótipo:
//   • "Precisa de você": cada fila com pendência em destaque vermelho,
//     o número grande e a ação ("Analisar agora"); filas zeradas
//     ficam discretas no fim;
//   • "Este mês": os números de negócio do mês;
//   • módulos agrupados (Moderação, Financeiro, Sistema) em lista
//     com descrição e balão;
//   • coluna "Totais" com os acumulados e a hora da atualização.
// Valores de receita e comissão só para superadmin, como no celular.
// Os dados são os mesmos da getAdminDashboard: nenhuma leitura nova.
// ============================================

import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { AdminDashboardData, formatBRL } from '../../services/marketplace/adminDashboardService';
import HoverPressable from '../../components/web/HoverPressable';

type Route = keyof RootStackParamList;

interface Props {
  data:         AdminDashboardData | null;
  loading:      boolean;
  refreshing:   boolean;
  error:        string | null;
  isSuperAdmin: boolean;
  rebuilding:   boolean;
  onRefresh:    () => void;
  onRebuild:    () => void;
  onBack:       () => void;
  go:           (route: Route) => void;
}

interface PendingTile { key: string; label: string; action: string; count: number; route: Route }
interface ModuleItem  { label: string; meta: string; count?: number; onPress: () => void }

function formatUpdated(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} de ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminDashboardDesktop({
  data, loading, refreshing, error, isSuperAdmin, rebuilding, onRefresh, onRebuild, onBack, go,
}: Props) {
  const p = data?.pending;
  const m = data?.metrics;
  const total = data?.totalPending ?? 0;

  const pending: PendingTile[] = [
    ...(isSuperAdmin ? [{ key: 'age', label: 'Verificações de idade', action: 'Analisar agora', count: p?.ageVerifications ?? 0, route: 'AdminAgeVerification' as Route }] : []),
    { key: 'products', label: 'Produtos em análise', action: 'Abrir fila', count: p?.products ?? 0, route: 'AdminProductsModeration' },
    { key: 'support',  label: 'Chamados de suporte', action: 'Responder', count: p?.support ?? 0, route: 'AdminSupport' },
    { key: 'creators', label: 'Pedidos de criador', action: 'Analisar', count: p?.creatorRequests ?? 0, route: 'AdminCreatorRequests' },
    ...(isSuperAdmin ? [
      { key: 'withdrawals', label: 'Saques', action: 'Conferir e pagar', count: p?.withdrawals ?? 0, route: 'AdminWithdrawals' as Route },
      { key: 'refunds',     label: 'Reembolsos', action: 'Decidir', count: p?.refunds ?? 0, route: 'AdminRefundRequests' as Route },
    ] : []),
    { key: 'fraud', label: 'Fraudes', action: 'Investigar', count: p?.fraud ?? 0, route: 'AdminFraudFlags' },
  ];
  // Com pendência primeiro; a ordem entre elas se mantém.
  pending.sort((a, b) => Number(b.count > 0) - Number(a.count > 0));

  const groups: Array<{ title: string; items: ModuleItem[] }> = [
    {
      title: 'Moderação',
      items: [
        { label: 'Criadores', meta: 'pedidos para vender', count: p?.creatorRequests, onPress: () => go('AdminCreatorRequests') },
        { label: 'Produtos',  meta: 'fila de análise',      count: p?.products,        onPress: () => go('AdminProductsModeration') },
        ...(isSuperAdmin ? [{ label: 'Idade', meta: 'verificações', count: p?.ageVerifications, onPress: () => go('AdminAgeVerification') }] : []),
        { label: 'Usuários',  meta: 'buscar e detalhar',                               onPress: () => go('AdminUserSearch') },
        ...(isSuperAdmin ? [{ label: 'Bloqueados', meta: 'contas suspensas', onPress: () => go('AdminBlockedUsers') }] : []),
        { label: 'Fraudes',   meta: 'sinalizações',         count: p?.fraud,           onPress: () => go('AdminFraudFlags') },
        { label: 'Suporte',   meta: 'chamados',             count: p?.support,         onPress: () => go('AdminSupport') },
        ...(isSuperAdmin ? [{ label: 'Vitrine', meta: 'curadoria', onPress: () => go('AdminCuration') }] : []),
      ],
    },
    {
      title: 'Financeiro',
      items: [
        { label: 'Vendas', meta: 'histórico', onPress: () => go('AdminSales') },
        ...(isSuperAdmin ? [
          { label: 'Reembolsos', meta: 'pedidos', count: p?.refunds,     onPress: () => go('AdminRefundRequests') },
          { label: 'Saques',     meta: 'criadores', count: p?.withdrawals, onPress: () => go('AdminWithdrawals') },
        ] : []),
        { label: 'Cupons', meta: 'campanhas', onPress: () => go('AdminCoupons') },
      ],
    },
    {
      title: 'Sistema',
      items: [
        { label: 'Relatórios', meta: 'mensal', onPress: () => go('AdminReports') },
        ...(isSuperAdmin ? [
          { label: 'Economia',   meta: 'inflação de cristais', onPress: () => go('AdminInflation') },
          { label: 'Meu Painel', meta: 'como criador',         onPress: () => go('CreatorPanel') },
          { label: rebuilding ? 'Recalculando…' : 'Recalcular painéis', meta: 'manutenção dos criadores', onPress: onRebuild },
        ] : []),
      ],
    },
  ];

  const kpis: Array<{ label: string; value: string; note?: string }> = m ? [
    ...(isSuperAdmin ? [
      { label: 'Receita da plataforma', value: formatBRL(m.monthlyCommission), note: 'comissão do mês' },
      { label: 'Receita bruta', value: formatBRL(m.monthlyRevenue), note: 'marketplace e cristais' },
    ] : []),
    { label: 'Vendas no marketplace', value: String(m.monthlyMarketplaceSales) },
    { label: 'Vendas de cristais', value: String(m.monthlyCoinsSales) },
    { label: 'Pedidos de reembolso', value: String(m.refundRequestsMonth) },
    ...(isSuperAdmin ? [
      { label: 'Taxa Pix Asaas', value: formatBRL(m.monthlyPixFees ?? 0), note: `${m.monthlyPixCount ?? 0} Pix recebidos` },
    ] : []),
  ] : [];

  const totals: Array<{ label: string; value: string }> = m ? [
    { label: 'Total de vendas', value: String(m.totalSales) },
    ...(isSuperAdmin ? [
      { label: 'Comissão total', value: formatBRL(m.totalCommission) },
      { label: 'Pago a criadores', value: formatBRL(m.totalWithdrawn) },
      { label: 'Taxa Pix (total)', value: formatBRL(m.totalPixFees ?? 0) },
    ] : []),
    { label: 'Criadores', value: String(m.creators) },
    { label: 'Produtos ativos', value: String(m.activeProducts) },
  ] : [];

  const updated = formatUpdated(m?.updatedAt);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>

          <View style={styles.header}>
            <HoverPressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar" style={styles.iconBtn} hoverStyle={styles.iconBtnHover}>
              <Text style={styles.iconBtnText}>‹</Text>
            </HoverPressable>
            <View style={styles.headerText}>
              <Text style={styles.h1} accessibilityRole="header">Painel Admin</Text>
              <Text style={[styles.subtitle, total > 0 && styles.subtitleAlert]}>
                {!data ? 'Carregando…' : total === 0 ? 'Tudo em dia ✓' : total === 1 ? '1 item esperando sua análise' : `${total} itens esperando sua análise`}
              </Text>
            </View>
            <HoverPressable
              onPress={onRefresh}
              disabled={refreshing}
              accessibilityRole="button"
              accessibilityLabel="Atualizar painel"
              style={styles.outlineBtn}
              hoverStyle={styles.outlineBtnHover}
            >
              {refreshing ? <ActivityIndicator color={colors.gold} size="small" /> : <Text style={styles.outlineBtnText}>↻ Atualizar</Text>}
            </HoverPressable>
            <View style={styles.role}>
              <Text style={styles.roleText}>{isSuperAdmin ? '👑 Superadmin' : '🔑 Admin'}</Text>
            </View>
          </View>

          {error && !data ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Não foi possível carregar o painel</Text>
              <Text style={styles.errorText}>{error}</Text>
              <HoverPressable onPress={onRefresh} accessibilityRole="button" style={styles.goldBtn} hoverStyle={styles.goldBtnHover}>
                <Text style={styles.goldBtnText}>Tentar de novo</Text>
              </HoverPressable>
            </View>
          ) : null}

          {/* ── Precisa de você ── */}
          <View style={styles.section}>
            <Text style={styles.kicker}>Precisa de você</Text>
            <View style={styles.pendingRow}>
              {pending.map(t => {
                const urgent = t.count > 0;
                return (
                  <HoverPressable
                    key={t.key}
                    onPress={() => go(t.route)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.label}: ${t.count} pendentes`}
                    style={[styles.pending, urgent ? styles.pendingUrgent : styles.pendingCalm]}
                    hoverStyle={urgent ? styles.pendingUrgentHover : styles.pendingCalmHover}
                  >
                    <Text style={[styles.pendingCount, urgent ? styles.textUrgent : styles.textCalm]}>
                      {loading && !data ? '–' : t.count > 99 ? '99+' : t.count}
                    </Text>
                    <Text style={styles.pendingLabel} numberOfLines={2}>{t.label}</Text>
                    <Text style={[styles.pendingAction, urgent ? styles.textUrgent : styles.textCalm]}>
                      {urgent ? `${t.action} ›` : 'Nada pendente'}
                    </Text>
                  </HoverPressable>
                );
              })}
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.main}>
              {/* ── Este mês ── */}
              <View style={styles.section}>
                <Text style={styles.kicker}>Este mês</Text>
                {loading && !data ? (
                  <ActivityIndicator color={colors.gold} style={styles.spinner} />
                ) : (
                  <View style={styles.kpis}>
                    {kpis.map(k => (
                      <View key={k.label} style={styles.kpi}>
                        <Text style={styles.kpiLabel}>{k.label}</Text>
                        <Text style={styles.kpiValue}>{k.value}</Text>
                        {k.note ? <Text style={styles.kpiNote}>{k.note}</Text> : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* ── Módulos ── */}
              <View style={styles.groups}>
                {groups.map(g => (
                  <View key={g.title} style={styles.group}>
                    <Text style={styles.kicker}>{g.title}</Text>
                    <View style={styles.groupCard}>
                      {g.items.map(item => (
                        <HoverPressable
                          key={item.label}
                          onPress={item.onPress}
                          accessibilityRole="button"
                          accessibilityLabel={item.count ? `${item.label}, ${item.count} pendentes` : item.label}
                          style={styles.moduleRow}
                          hoverStyle={styles.moduleRowHover}
                        >
                          <View style={styles.moduleText}>
                            <Text style={styles.moduleLabel}>{item.label}</Text>
                            <Text style={styles.moduleMeta}>{item.meta}</Text>
                          </View>
                          {item.count ? (
                            <View style={styles.badge}><Text style={styles.badgeText}>{item.count > 99 ? '99+' : item.count}</Text></View>
                          ) : null}
                          <Text style={styles.moduleArrow}>›</Text>
                        </HoverPressable>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Totais ── */}
            <View style={styles.aside}>
              <Text style={styles.kicker}>Totais</Text>
              <View style={styles.totalsCard}>
                {loading && !data ? (
                  <ActivityIndicator color={colors.gold} style={styles.spinner} />
                ) : totals.map(t => (
                  <View key={t.label} style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{t.label}</Text>
                    <Text style={styles.totalValue}>{t.value}</Text>
                  </View>
                ))}
              </View>
              {updated && <Text style={styles.updated}>Números atualizados às {updated}</Text>}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll:    { flexGrow: 1 },
  page:      { width: '100%', maxWidth: 1320, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 28, paddingBottom: 48, gap: 28 },

  header:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: 4 },
  h1:         { color: colors.white, fontSize: 28, fontWeight: 'bold' },
  subtitle:   { color: colors.textSecondary, fontSize: fonts.sizes.md },
  subtitleAlert: { color: '#F07075', fontWeight: 'bold' },
  iconBtn:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.grayDark },
  iconBtnHover: { borderColor: colors.gold },
  iconBtnText: { color: colors.gold, fontSize: 26, lineHeight: 28 },
  outlineBtn: { minWidth: 120, height: 40, paddingHorizontal: 16, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.grayDark, alignItems: 'center', justifyContent: 'center' },
  outlineBtnHover: { borderColor: colors.gold },
  outlineBtnText: { color: colors.grayLight, fontWeight: 'bold', fontSize: fonts.sizes.md },
  role:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.goldGlow },
  roleText:   { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.sm },

  errorBox:   { padding: 20, gap: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.error + '66', backgroundColor: colors.error + '12', alignItems: 'flex-start' },
  errorTitle: { color: colors.white, fontWeight: 'bold', fontSize: fonts.sizes.lg },
  errorText:  { color: colors.textSecondary, fontSize: fonts.sizes.sm },
  goldBtn:    { marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, borderRadius: borderRadius.full, backgroundColor: colors.gold },
  goldBtnHover: { backgroundColor: colors.goldLight },
  goldBtnText: { color: colors.background, fontWeight: 'bold' },

  section:  { gap: 12 },
  kicker:   { color: colors.gray, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  spinner:  { paddingVertical: spacing.lg },

  pendingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pending:    { flexGrow: 1, flexBasis: 150, maxWidth: 240, minHeight: 128, padding: 16, gap: 6, borderRadius: 18, borderWidth: 1 },
  pendingUrgent: { backgroundColor: 'rgba(229,72,77,0.10)', borderColor: 'rgba(229,72,77,0.45)' },
  pendingUrgentHover: { borderColor: '#F07075' },
  pendingCalm:   { backgroundColor: colors.surface, borderColor: '#2E2E2E' },
  pendingCalmHover: { borderColor: colors.grayDark },
  pendingCount:  { fontSize: 32, fontWeight: 'bold' },
  pendingLabel:  { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  pendingAction: { fontSize: fonts.sizes.sm, fontWeight: 'bold', marginTop: 'auto' },
  textUrgent:    { color: '#F07075' },
  textCalm:      { color: colors.gray },

  body:  { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  main:  { flex: 1, minWidth: 0, gap: 28 },
  kpis:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpi:   { flexGrow: 1, flexBasis: 200, padding: 18, gap: 4, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#2E2E2E' },
  kpiLabel: { color: colors.gray, fontSize: 13 },
  kpiValue: { color: colors.goldLight, fontSize: 24, fontWeight: 'bold' },
  kpiNote:  { color: colors.textMuted, fontSize: 12 },

  groups:    { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' },
  group:     { flexGrow: 1, flexBasis: 240, gap: 10 },
  groupCard: { padding: 6, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#2E2E2E' },
  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12 },
  moduleRowHover: { backgroundColor: colors.surfaceRaised },
  moduleText: { flex: 1, gap: 2 },
  moduleLabel: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  moduleMeta:  { color: colors.gray, fontSize: 12 },
  moduleArrow: { color: colors.gray, fontSize: 20 },
  badge:     { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: 'bold' },

  aside:      { width: 300, gap: 12 },
  totalsCard: { padding: 8, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#2E2E2E' },
  totalRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#232323' },
  totalLabel: { color: colors.textSecondary, fontSize: fonts.sizes.md },
  totalValue: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  updated:    { color: colors.textMuted, fontSize: 12, paddingHorizontal: 4 },
});

// ============================================
// LUMINA — SAQUES (ADMIN) v2
// src/screens/admin/AdminWithdrawalsScreen.tsx
//
// v2 (28/09):
// - "Conferir": chave Pix completa com Copiar, saldo, saldo depois do
//   saque, dívida e a CONFERÊNCIA ANTIFRAUDE (saldo gravado contra o
//   histórico de vendas e saques). Alerta ANTES de aprovar.
// - Aviso se a chave do saque divergir da cadastrada hoje.
// - Um modal de rejeição só (antes havia um dentro de cada card).
// ============================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Modal, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { getWithdrawals, getUserById } from '../../services/marketplace/adminService';
import {
  fetchWithdrawalReview, callAdminAction, formatBRL, PIX_TYPE_LABEL, WithdrawalReview,
} from '../../services/marketplace/adminDashboardService';
import { Withdrawal } from '../../shared/types/marketplace';
import { useSuperAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';

const STATUS_TABS = ['pending', 'approved', 'paid', 'rejected'] as const;
type StatusTab = typeof STATUS_TABS[number];

const STATUS_LABELS: Record<StatusTab, string> = {
  pending: 'Pendentes', approved: 'Aguardando Pix', paid: 'Pagos', rejected: 'Rejeitados',
};

async function copy(value: string, what: string) {
  await Clipboard.setStringAsync(value);
  Alert.alert('Copiado', `${what} copiada para a área de transferência.`);
}

export default function AdminWithdrawalsScreen() {
  const navigation = useNavigation();
  const { blocked, loading: guardLoading } = useSuperAdminGuard();

  const [activeTab, setActiveTab]     = useState<StatusTab>('pending');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [names, setNames]             = useState<Record<string, string>>({});
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [processing, setProcessing]   = useState<string | null>(null);

  const [expanded, setExpanded]           = useState<string | null>(null);
  const [reviews, setReviews]             = useState<Record<string, WithdrawalReview>>({});
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<Withdrawal | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getWithdrawals(activeTab);
      setWithdrawals(result.withdrawals);
      const ids = Array.from(new Set(result.withdrawals.map(w => w.userId)));
      const entries = await Promise.all(ids.map(async id => {
        const u = await getUserById(id).catch(() => null);
        return [id, u?.name ?? `${id.slice(0, 10)}…`] as const;
      }));
      setNames(prev => ({ ...prev, ...Object.fromEntries(entries) }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar saques.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { setExpanded(null); load(); }, [load]);

  async function toggleReview(w: Withdrawal) {
    if (expanded === w.id) { setExpanded(null); return; }
    setExpanded(w.id);
    setReviewLoading(w.id);
    try {
      const review = await fetchWithdrawalReview(w.id);
      setReviews(prev => ({ ...prev, [w.id]: review }));
    } catch (e: unknown) {
      Alert.alert('Conferência', e instanceof Error ? e.message : 'Não foi possível conferir.');
      setExpanded(null);
    } finally {
      setReviewLoading(null);
    }
  }

  async function run(id: string, fn: string, params: Record<string, unknown>, done: string) {
    setProcessing(id);
    try {
      await callAdminAction(fn, params);
      Alert.alert(done);
      await load();
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      setProcessing(null);
    }
  }

  function approve(w: Withdrawal) {
    const r = reviews[w.id];
    const warn = r?.reconciliation.alert
      ? `\n\n⚠️ ATENÇÃO: saldo ${formatBRL(r.reconciliation.diff)} acima do histórico. Confira antes de aprovar.`
      : !r ? '\n\nVocê ainda não conferiu este saque.' : '';
    Alert.alert('Aprovar saque?', `${formatBRL(w.amount)} para ${names[w.userId] ?? 'o criador'}.${warn}`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aprovar', onPress: () => run(w.id, 'onApproveWithdrawal', { withdrawalId: w.id }, '✅ Saque aprovado') },
    ]);
  }

  function markPaid(w: Withdrawal) {
    Alert.alert(
      'Confirmar pagamento',
      `Você já transferiu ${formatBRL(w.amount)} para a chave ${w.pixKey}?\n\nO valor sai do saldo do criador agora.`,
      [
        { text: 'Ainda não', style: 'cancel' },
        { text: 'Já transferi', onPress: () => run(w.id, 'onMarkWithdrawalPaid', { withdrawalId: w.id }, '✅ Saque marcado como pago') },
      ],
    );
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      Alert.alert('Motivo obrigatório', 'Informe o motivo da rejeição.');
      return;
    }
    const target = rejectTarget;
    setRejectTarget(null);
    await run(target.id, 'onRejectWithdrawal', { withdrawalId: target.id, reason: rejectReason.trim() }, '❌ Saque rejeitado');
  }

  if (guardLoading || blocked) return null;

  function renderReview(w: Withdrawal) {
    if (reviewLoading === w.id) return <ActivityIndicator color={colors.gold} style={{ marginVertical: spacing.sm }} />;
    const r = reviews[w.id];
    if (!r) return null;
    const rec = r.reconciliation;

    return (
      <View style={styles.review}>
        {rec.alert ? (
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>⚠️ Saldo {formatBRL(rec.diff)} acima do histórico</Text>
            <Text style={styles.alertText}>
              Esperado {formatBRL(rec.expected)} ({rec.creditedSales} vendas − saques pagos) · gravado {formatBRL(rec.actual)}.
              Pode ser crédito indevido. Não aprove sem investigar.
            </Text>
          </View>
        ) : (
          <View style={styles.okBox}>
            <Text style={styles.okText}>✓ Saldo confere com o histórico ({rec.creditedSales} vendas)</Text>
          </View>
        )}

        {!r.keyMatches && (
          <View style={styles.alertBox}>
            <Text style={styles.alertText}>
              ⚠️ A chave deste saque é diferente da chave cadastrada hoje
              {r.currentPixKey ? ` (${r.currentPixKey})` : ''}. Confirme com o criador.
            </Text>
          </View>
        )}

        <Text style={styles.reviewLabel}>Chave Pix · {PIX_TYPE_LABEL[w.pixType ?? ''] ?? w.pixType}</Text>
        <View style={styles.pixRow}>
          <Text style={styles.pixKey} selectable>{w.pixKey}</Text>
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={() => w.pixKey && copy(w.pixKey, 'Chave Pix')}
            accessibilityRole="button"
            accessibilityLabel="Copiar chave Pix"
          >
            <Text style={styles.copyText}>Copiar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.numbers}>
          <View style={styles.numberBox}>
            <Text style={styles.numberLabel}>Disponível</Text>
            <Text style={styles.numberValue}>{formatBRL(r.wallet.available)}</Text>
          </View>
          <View style={styles.numberBox}>
            <Text style={styles.numberLabel}>Depois do saque</Text>
            <Text style={[styles.numberValue, r.afterWithdrawal < 0 && { color: colors.error }]}>
              {formatBRL(r.afterWithdrawal)}
            </Text>
          </View>
          {r.wallet.debt > 0 && (
            <View style={styles.numberBox}>
              <Text style={styles.numberLabel}>Dívida</Text>
              <Text style={[styles.numberValue, { color: colors.error }]}>{formatBRL(r.wallet.debt)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.reviewMeta}>
          Ganhou {formatBRL(r.wallet.totalEarned)} · já sacou {formatBRL(r.wallet.totalWithdrawn)}
          {r.wallet.chargebackPending ? ' · ⚠️ chargeback pendente' : ''}
        </Text>
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saques</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        {STATUS_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{STATUS_LABELS[tab]}</Text>
          </TouchableOpacity>
        ))}
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
          data={withdrawals}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.gold} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhum saque {STATUS_LABELS[activeTab].toLowerCase()}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const actionable = activeTab === 'pending' || activeTab === 'approved';
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.amount}>{formatBRL(item.amount)}</Text>
                  <Text style={styles.date}>{item.createdAt.toLocaleDateString('pt-BR')}</Text>
                </View>
                <Text style={styles.creator}>🎨 {names[item.userId] ?? `${item.userId.slice(0, 10)}…`}</Text>

                {actionable && (
                  <TouchableOpacity style={styles.reviewBtn} onPress={() => toggleReview(item)} accessibilityRole="button">
                    <Text style={styles.reviewBtnText}>{expanded === item.id ? '▲ Fechar conferência' : '🔍 Conferir saque'}</Text>
                  </TouchableOpacity>
                )}

                {expanded === item.id && renderReview(item)}

                {processing === item.id ? (
                  <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.sm }} />
                ) : activeTab === 'pending' ? (
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => approve(item)}>
                      <Text style={styles.approveBtnText}>✅ Aprovar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => { setRejectTarget(item); setRejectReason(''); }}>
                      <Text style={styles.rejectBtnText}>❌ Rejeitar</Text>
                    </TouchableOpacity>
                  </View>
                ) : activeTab === 'approved' ? (
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.paidBtn} onPress={() => markPaid(item)}>
                      <Text style={styles.paidBtnText}>💸 Marcar como pago</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => { setRejectTarget(item); setRejectReason(''); }}>
                      <Text style={styles.rejectBtnText}>❌ Rejeitar</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {item.rejectionReason ? <Text style={styles.reason}>Motivo: {item.rejectionReason}</Text> : null}
              </View>
            );
          }}
        />
      )}

      <Modal visible={rejectTarget !== null} transparent animationType="fade" onRequestClose={() => setRejectTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rejeitar saque</Text>
            <Text style={styles.modalSubtitle}>{formatBRL(rejectTarget?.amount)}</Text>
            <TextInput
              style={styles.modalInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Motivo da rejeição"
              placeholderTextColor={colors.gray}
              autoFocus
              maxLength={300}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRejectTarget(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmReject}>
                <Text style={styles.modalConfirmText}>Rejeitar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.grayDark },
  tab: { flex: 1, padding: spacing.sm, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabText: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },
  tabTextActive: { color: colors.gold, fontWeight: 'bold' },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md, gap: spacing.xs,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { color: colors.gold, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  date: { color: colors.gray, fontSize: fonts.sizes.sm },
  creator: { color: colors.white, fontSize: fonts.sizes.sm },
  reviewBtn: {
    marginTop: spacing.xs, paddingVertical: spacing.sm, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gold + '66', alignItems: 'center',
  },
  reviewBtnText: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  review: { gap: spacing.sm, marginTop: spacing.sm },
  alertBox: {
    backgroundColor: colors.error + '14', borderRadius: borderRadius.sm,
    borderLeftWidth: 3, borderLeftColor: colors.error, padding: spacing.sm, gap: 4,
  },
  alertTitle: { color: colors.error, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  alertText: { color: colors.error, fontSize: fonts.sizes.xs, lineHeight: 17 },
  okBox: {
    backgroundColor: colors.success + '14', borderRadius: borderRadius.sm,
    borderLeftWidth: 3, borderLeftColor: colors.success, padding: spacing.sm,
  },
  okText: { color: colors.success, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  reviewLabel: { color: colors.gray, fontSize: fonts.sizes.xs },
  pixRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pixKey: { flex: 1, color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  copyBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.full,
    backgroundColor: colors.gold,
  },
  copyText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  numbers: { flexDirection: 'row', gap: spacing.sm },
  numberBox: { flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.sm, padding: spacing.sm },
  numberLabel: { color: colors.gray, fontSize: 10 },
  numberValue: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold', marginTop: 2 },
  reviewMeta: { color: colors.gray, fontSize: fonts.sizes.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  approveBtn: {
    backgroundColor: colors.success + '22', borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: colors.success, flex: 1, padding: spacing.sm, alignItems: 'center',
  },
  approveBtnText: { color: colors.success, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  rejectBtn: {
    backgroundColor: colors.error + '11', borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: colors.error, flex: 1, padding: spacing.sm, alignItems: 'center',
  },
  rejectBtnText: { color: colors.error, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  paidBtn: {
    backgroundColor: colors.gold + '22', borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: colors.gold, flex: 1, padding: spacing.sm, alignItems: 'center',
  },
  paidBtnText: { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  reason: { color: colors.error, fontSize: fonts.sizes.xs, marginTop: spacing.xs },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.md },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn: { backgroundColor: colors.gold, borderRadius: borderRadius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { color: colors.background, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.md },
  modalContent: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark, padding: spacing.lg,
  },
  modalTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', marginBottom: spacing.xs },
  modalSubtitle: { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.md },
  modalInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.grayDark, color: colors.white,
    padding: spacing.md, fontSize: fonts.sizes.md, marginBottom: spacing.md,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalCancelBtn: {
    flex: 1, padding: spacing.md, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gray, alignItems: 'center',
  },
  modalCancelText: { color: colors.gray, fontWeight: 'bold' },
  modalConfirmBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.sm, backgroundColor: colors.error, alignItems: 'center' },
  modalConfirmText: { color: colors.white, fontWeight: 'bold' },
});
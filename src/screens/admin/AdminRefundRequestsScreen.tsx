// ============================================
// LUMINA — REEMBOLSOS (ADMIN) v2 — estorno manual por Pix
// src/screens/admin/AdminRefundRequestsScreen.tsx
//
// Fluxo: Pendente → (Aprovar: revoga a compra e desconta o criador)
// → Aguardando Pix → (você transfere e toca "Marcar como pago") → Pago.
// A chave Pix do comprador aparece com Copiar.
// ============================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { getRefundRequests, getUserById } from '../../services/marketplace/adminService';
import { getProductsByIds } from '../../services/marketplace/productService';
import {
  callAdminAction, formatBRL, PIX_TYPE_LABEL,
} from '../../services/marketplace/adminDashboardService';
import { RefundRequest } from '../../shared/types/marketplace';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';

const TABS = ['pending', 'approved', 'paid', 'rejected'] as const;
type Tab = typeof TABS[number];

const TAB_LABEL: Record<Tab, string> = {
  pending: 'Pendentes', approved: 'Aguardando Pix', paid: 'Pagos', rejected: 'Rejeitados',
};

function formatDate(value: unknown): string {
  const d = value instanceof Date ? value : (value as { toDate?: () => Date })?.toDate?.();
  if (!d) return '';
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function AdminRefundRequestsScreen() {
  const navigation = useNavigation();
  const { blocked, loading: guardLoading } = useAdminGuard();

  const [tab, setTab]               = useState<Tab>('pending');
  const [requests, setRequests]     = useState<RefundRequest[]>([]);
  const [names, setNames]           = useState<Record<string, string>>({});
  const [titles, setTitles]         = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const [rejectId, setRejectId]         = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRefundRequests(tab, 20);
      setRequests(result.requests);

      const userIds = Array.from(new Set(result.requests.flatMap(r => [r.buyerId, r.sellerId])));
      const [userEntries, products] = await Promise.all([
        Promise.all(userIds.map(async id => {
          const u = await getUserById(id).catch(() => null);
          return [id, u?.name ?? `${id.slice(0, 10)}…`] as const;
        })),
        getProductsByIds(result.requests.map(r => r.productId)).catch(() => new Map()),
      ]);
      setNames(prev => ({ ...prev, ...Object.fromEntries(userEntries) }));
      const t: Record<string, string> = {};
      products.forEach((p, id) => { t[id] = p.title; });
      setTitles(prev => ({ ...prev, ...t }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar reembolsos.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

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

  function approve(r: RefundRequest) {
    Alert.alert(
      'Aprovar reembolso?',
      `• A compra é revogada (o conteúdo sai da biblioteca)\n` +
        `• ${formatBRL(r.sellerAmount)} são descontados do criador\n\n` +
        `Depois, faça o Pix de ${formatBRL(r.amount)} para a chave do comprador e toque em "Marcar como pago".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprovar', onPress: () => run(r.id, 'approveRefund', { refundRequestId: r.id }, '✅ Reembolso aprovado — faça o Pix') },
      ],
    );
  }

  function markPaid(r: RefundRequest) {
    Alert.alert(
      'Confirmar pagamento',
      `Você já transferiu ${formatBRL(r.amount)} para ${r.buyerPixKey ?? 'a chave do comprador'}?`,
      [
        { text: 'Ainda não', style: 'cancel' },
        { text: 'Já transferi', onPress: () => run(r.id, 'markRefundPaid', { refundRequestId: r.id }, '✅ Reembolso marcado como pago') },
      ],
    );
  }

  async function confirmReject() {
    if (!rejectId) return;
    if (!rejectReason.trim()) {
      Alert.alert('Motivo obrigatório', 'Informe o motivo da rejeição.');
      return;
    }
    const id = rejectId;
    setRejectId(null);
    await run(id, 'rejectRefund', { refundRequestId: id, reason: rejectReason.trim() }, '❌ Reembolso rejeitado');
  }

  if (guardLoading || blocked) return null;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reembolsos</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)} accessibilityRole="tab">
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{TAB_LABEL[t]}</Text>
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
          data={requests}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.gold} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>↩️</Text>
              <Text style={styles.emptyText}>Nenhum reembolso em "{TAB_LABEL[tab]}"</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.product} numberOfLines={2}>📦 {titles[item.productId] ?? 'Produto'}</Text>

              <View style={styles.valuesRow}>
                <View style={styles.valueBox}>
                  <Text style={styles.valueLabel}>Devolver ao comprador</Text>
                  <Text style={styles.valueMain}>{formatBRL(item.amount)}</Text>
                </View>
                <View style={styles.valueBox}>
                  <Text style={styles.valueLabel}>Sai do criador</Text>
                  <Text style={styles.valueLoss}>{formatBRL(item.sellerAmount)}</Text>
                </View>
              </View>

              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>Motivo do comprador</Text>
                <Text style={styles.reasonText}>{item.reason || '—'}</Text>
              </View>

              <Text style={styles.party}>🛒 Comprador: <Text style={styles.partyValue}>{names[item.buyerId] ?? '…'}</Text></Text>
              <Text style={styles.party}>🎨 Criador: <Text style={styles.partyValue}>{names[item.sellerId] ?? '…'}</Text></Text>
              <Text style={styles.date}>Pedido em {formatDate(item.createdAt)}</Text>

              {(tab === 'pending' || tab === 'approved') && item.buyerPixKey ? (
                <View style={styles.pixBox}>
                  <Text style={styles.pixLabel}>Chave Pix do comprador · {PIX_TYPE_LABEL[item.buyerPixKeyType ?? ''] ?? ''}</Text>
                  <View style={styles.pixRow}>
                    <Text style={styles.pixKey} selectable>{item.buyerPixKey}</Text>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={async () => {
                        await Clipboard.setStringAsync(item.buyerPixKey ?? '');
                        Alert.alert('Copiado', 'Chave Pix copiada.');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Copiar chave Pix do comprador"
                    >
                      <Text style={styles.copyText}>Copiar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {tab === 'rejected' && item.rejectionReason ? (
                <Text style={styles.rejection}>Motivo da rejeição: {item.rejectionReason}</Text>
              ) : null}

              {processing === item.id ? (
                <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.sm }} />
              ) : tab === 'pending' ? (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => approve(item)}>
                    <Text style={styles.approveText}>✅ Aprovar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => { setRejectId(item.id); setRejectReason(''); }}>
                    <Text style={styles.rejectText}>❌ Rejeitar</Text>
                  </TouchableOpacity>
                </View>
              ) : tab === 'approved' ? (
                <TouchableOpacity style={styles.paidBtn} onPress={() => markPaid(item)}>
                  <Text style={styles.paidText}>💸 Marcar reembolso como pago</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      )}

      <Modal visible={rejectId !== null} transparent animationType="fade" onRequestClose={() => setRejectId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rejeitar reembolso</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Motivo (o comprador recebe este texto)"
              placeholderTextColor={colors.gray}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              maxLength={300}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRejectId(null)}>
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
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.grayDark },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabText: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },
  tabTextActive: { color: colors.gold, fontWeight: 'bold' },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md, gap: spacing.xs,
  },
  product: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  valuesRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.xs },
  valueBox: { flex: 1 },
  valueLabel: { color: colors.gray, fontSize: fonts.sizes.xs },
  valueMain: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  valueLoss: { color: colors.error, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  reasonBox: { backgroundColor: colors.background, borderRadius: borderRadius.sm, padding: spacing.sm },
  reasonLabel: { color: colors.gray, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  reasonText: { color: colors.white, fontSize: fonts.sizes.sm, marginTop: 2 },
  party: { color: colors.gray, fontSize: fonts.sizes.xs },
  partyValue: { color: colors.white },
  date: { color: colors.gray, fontSize: fonts.sizes.xs },
  pixBox: {
    marginTop: spacing.xs, padding: spacing.sm, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gold + '55', gap: 4,
  },
  pixLabel: { color: colors.gray, fontSize: fonts.sizes.xs },
  pixRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pixKey: { flex: 1, color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  copyBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.full, backgroundColor: colors.gold },
  copyText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  rejection: { color: colors.error, fontSize: fonts.sizes.xs, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  approveBtn: {
    flex: 1, padding: spacing.sm, alignItems: 'center', borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.success, backgroundColor: colors.success + '22',
  },
  approveText: { color: colors.success, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  rejectBtn: {
    flex: 1, padding: spacing.sm, alignItems: 'center', borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.error, backgroundColor: colors.error + '11',
  },
  rejectText: { color: colors.error, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  paidBtn: {
    marginTop: spacing.sm, padding: spacing.sm, alignItems: 'center', borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.gold + '22',
  },
  paidText: { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn: { backgroundColor: colors.gold, borderRadius: borderRadius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { color: colors.background, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalContent: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.lg, width: '100%', gap: spacing.md,
  },
  modalTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  modalInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: colors.grayDark, color: colors.white, padding: spacing.md,
    fontSize: fonts.sizes.md, textAlignVertical: 'top', minHeight: 80,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalCancelBtn: { flex: 1, backgroundColor: colors.grayDark, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center' },
  modalCancelText: { color: colors.white, fontWeight: 'bold' },
  modalConfirmBtn: { flex: 1, backgroundColor: colors.error, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center' },
  modalConfirmText: { color: colors.white, fontWeight: 'bold' },
});
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput, Modal,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { getRefundRequests, getUserById } from '../../services/marketplace/adminService';
import { RefundRequest, RefundRequestStatus } from '../../shared/types/marketplace';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import app from '../../core/firebase';
import ScreenContainer from '../../components/ScreenContainer';

const STATUS_TABS: RefundRequestStatus[] = ['pending', 'approved', 'rejected', 'expired'];

const STATUS_LABEL: Record<RefundRequestStatus, string> = {
  pending: 'Pendentes',
  approved: 'Aprovados',
  rejected: 'Rejeitados',
  expired: 'Expirados',
};

function formatDate(value: any): string {
  try {
    const d = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
    if (!d) return '';
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return '';
  }
}

function formatMoney(v: number | undefined): string {
  const n = typeof v === 'number' ? v : 0;
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

// Menos de 6h para expirar → aviso
function isExpiringSoon(expiresAt: any): boolean {
  try {
    const d = expiresAt?.toDate ? expiresAt.toDate() : expiresAt instanceof Date ? expiresAt : null;
    if (!d) return false;
    const hoursLeft = (d.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursLeft > 0 && hoursLeft < 6;
  } catch {
    return false;
  }
}

export default function AdminRefundRequestsScreen() {
  const navigation = useNavigation();
  const { blocked, loading: guardLoading } = useAdminGuard();
  const [activeTab, setActiveTab] = useState<RefundRequestStatus>('pending');
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Modal de rejeição
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRefundRequests(activeTab, 20);
      setRequests(result.requests);

      const ids = new Set<string>();
      result.requests.forEach(r => { ids.add(r.buyerId); ids.add(r.sellerId); });
      const names: Record<string, string> = {};
      await Promise.all(
        Array.from(ids).map(async id => {
          try {
            const p = await getUserById(id);
            names[id] = p?.name ?? id.slice(0, 10) + '...';
          } catch {
            names[id] = id.slice(0, 10) + '...';
          }
        })
      );
      setUserNames(names);
    } catch (e: any) {
      console.error('[AdminRefundRequests] Erro:', e);
      setError(e.message ?? 'Erro ao carregar reembolsos');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  React.useEffect(() => { loadRequests(); }, [activeTab]);

  if (guardLoading || blocked) return null;

  function handleApprove(req: RefundRequest) {
    Alert.alert(
      '⚠️ Aprovar reembolso?',
      'Esta ação irá:\n\n' +
      '• Executar o estorno REAL no Asaas\n' +
      '• Devolver o valor ao comprador\n' +
      '• Remover o acesso ao produto\n' +
      '• Debitar o saldo do criador\n\n' +
      'Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar estorno',
          style: 'destructive',
          onPress: async () => {
            setProcessing(req.id);
            try {
              const functions = getFunctions(app, 'us-central1');
              const approve = httpsCallable(functions, 'approveRefund');
              await approve({ refundRequestId: req.id });
              Alert.alert('✅ Reembolso aprovado', 'O estorno foi processado no Asaas.');
              loadRequests();
            } catch (e: any) {
              Alert.alert('Erro', e.message ?? 'Não foi possível processar o estorno.');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  }

  function openRejectModal(id: string) {
    setRejectingId(id);
    setRejectReason('');
    setRejectModal(true);
  }

  async function confirmReject() {
    if (!rejectingId) return;
    if (!rejectReason.trim()) {
      Alert.alert('Erro', 'Informe o motivo da rejeição.');
      return;
    }
    setRejectModal(false);
    setProcessing(rejectingId);
    try {
      const functions = getFunctions(app, 'us-central1');
      const reject = httpsCallable(functions, 'rejectRefund');
      await reject({ refundRequestId: rejectingId, reason: rejectReason.trim() });
      Alert.alert('❌ Reembolso rejeitado');
      loadRequests();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setProcessing(null);
      setRejectingId(null);
    }
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reembolsos</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs — scroll horizontal (4 abas) */}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {STATUS_TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {STATUS_LABEL[tab]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadRequests}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={loadRequests} tintColor={colors.gold} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>↩️</Text>
              <Text style={styles.emptyText}>
                Nenhum reembolso {STATUS_LABEL[activeTab].toLowerCase()}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const expiringSoon = activeTab === 'pending' && isExpiringSoon(item.expiresAt);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardProduct}>📦 {item.productId.slice(0, 18)}...</Text>
                  {expiringSoon && (
                    <Text style={styles.expiringSoon}>⚠️ Expira em breve</Text>
                  )}
                </View>

                {/* Financeiro */}
                <View style={styles.valuesRow}>
                  <View style={styles.valueBox}>
                    <Text style={styles.valueLabel}>Reembolso</Text>
                    <Text style={styles.valueMain}>{formatMoney(item.amount)}</Text>
                  </View>
                  <View style={styles.valueBox}>
                    <Text style={styles.valueLabel}>Criador perde</Text>
                    <Text style={styles.valueSecondary}>{formatMoney(item.sellerAmount)}</Text>
                  </View>
                </View>

                {/* Motivo do comprador */}
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Motivo do comprador:</Text>
                  <Text style={styles.reasonText}>{item.reason || '—'}</Text>
                </View>

                {/* Partes */}
                <Text style={styles.party}>
                  🛒 Comprador: <Text style={styles.partyValue}>{userNames[item.buyerId] ?? item.buyerId.slice(0, 10) + '...'}</Text>
                </Text>
                <Text style={styles.party}>
                  🎨 Criador: <Text style={styles.partyValue}>{userNames[item.sellerId] ?? item.sellerId.slice(0, 10) + '...'}</Text>
                </Text>

                {/* Datas */}
                <Text style={styles.date}>Criado: {formatDate(item.createdAt)}</Text>
                {activeTab === 'pending' && (
                  <Text style={styles.date}>Expira: {formatDate(item.expiresAt)}</Text>
                )}

                {/* Rejeição */}
                {activeTab === 'rejected' && item.rejectionReason && (
                  <View style={styles.rejectionBox}>
                    <Text style={styles.rejectionLabel}>Motivo da rejeição:</Text>
                    <Text style={styles.rejectionText}>{item.rejectionReason}</Text>
                  </View>
                )}

                {/* Ações — só pending */}
                {activeTab === 'pending' && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApprove(item)}
                      disabled={processing === item.id}
                    >
                      {processing === item.id ? (
                        <ActivityIndicator color={colors.success} size="small" />
                      ) : (
                        <Text style={styles.approveBtnText}>✅ Aprovar estorno</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => openRejectModal(item.id)}
                      disabled={processing === item.id}
                    >
                      <Text style={styles.rejectBtnText}>❌ Rejeitar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Modal de rejeição */}
      <Modal
        visible={rejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>❌ Rejeitar reembolso</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Informe o motivo da rejeição..."
              placeholderTextColor={colors.gray}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRejectModal(false)}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmReject}>
                <Text style={styles.modalConfirmBtnText}>Rejeitar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  tabsWrap: { borderBottomWidth: 0.5, borderBottomColor: colors.grayDark },
  tab: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabText: { color: colors.gray, fontSize: fonts.sizes.sm },
  tabTextActive: { color: colors.gold, fontWeight: 'bold' },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
    gap: spacing.xs,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardProduct: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  expiringSoon: { color: colors.gold, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  valuesRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.xs },
  valueBox: { flex: 1 },
  valueLabel: { color: colors.gray, fontSize: fonts.sizes.xs },
  valueMain: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  valueSecondary: { color: colors.error, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  reasonBox: {
    backgroundColor: colors.background, borderRadius: borderRadius.sm,
    padding: spacing.sm, marginVertical: spacing.xs,
  },
  reasonLabel: { color: colors.gray, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  reasonText: { color: colors.white, fontSize: fonts.sizes.sm, marginTop: 2 },
  party: { color: colors.gray, fontSize: fonts.sizes.xs },
  partyValue: { color: colors.white },
  date: { color: colors.gray, fontSize: fonts.sizes.xs },
  rejectionBox: {
    marginTop: spacing.xs, padding: spacing.sm,
    backgroundColor: colors.error + '11', borderRadius: borderRadius.sm,
    borderLeftWidth: 2, borderLeftColor: colors.error,
  },
  rejectionLabel: { color: colors.error, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  rejectionText: { color: colors.white, fontSize: fonts.sizes.sm, marginTop: 2 },
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
  errorContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl,
  },
  errorIcon: { fontSize: 48 },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.sm,
    padding: spacing.md, paddingHorizontal: spacing.xl,
  },
  retryBtnText: { color: colors.background, fontWeight: 'bold' },
  empty: { flex: 1, alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
  modalOverlay: {
    flex: 1, backgroundColor: '#00000088',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
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
  modalCancelBtn: {
    flex: 1, backgroundColor: colors.grayDark, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
  },
  modalCancelBtnText: { color: colors.white, fontWeight: 'bold' },
  modalConfirmBtn: {
    flex: 1, backgroundColor: colors.error, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
  },
  modalConfirmBtnText: { color: colors.white, fontWeight: 'bold' },
});
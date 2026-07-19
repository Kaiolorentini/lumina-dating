import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Modal,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Input } from '../../components/ui';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha , colors } from '../../theme/tokens';
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
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
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
        <ActivityIndicator color={COLORS.gold} style={{ flex: 1 }} />
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
            <RefreshControl refreshing={false} onRefresh={loadRequests} tintColor={COLORS.gold} />
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
                        <ActivityIndicator color={COLORS.success} size="small" />
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
            <Input
              placeholder="Informe o motivo da rejeição..."
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button label="Cancelar" variant="ghost" onPress={() => setRejectModal(false)} />
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.gold + '44',
  },
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  tabsWrap: { borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  tab: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.gold },
  tabText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  tabTextActive: { color: COLORS.gold, fontWeight: FONT_WEIGHT.bold },
  list: { padding: SPACING.md },
  card: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardProduct: { color: COLORS.textPrimary, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  expiringSoon: { color: COLORS.gold, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  valuesRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: SPACING.xs },
  valueBox: { flex: 1 },
  valueLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  valueMain: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  valueSecondary: { color: COLORS.error, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  reasonBox: {
    backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm, marginVertical: SPACING.xs,
  },
  reasonLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  reasonText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.caption, marginTop: 2 },
  party: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  partyValue: { color: COLORS.textPrimary },
  date: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  rejectionBox: {
    marginTop: SPACING.xs, padding: SPACING.sm,
    backgroundColor: COLORS.error + '11', borderRadius: BORDER_RADIUS.sm,
    borderLeftWidth: 2, borderLeftColor: COLORS.error,
  },
  rejectionLabel: { color: COLORS.error, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  rejectionText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.caption, marginTop: 2 },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  approveBtn: {
    backgroundColor: COLORS.success + '22', borderRadius: BORDER_RADIUS.sm, borderWidth: 1,
    borderColor: COLORS.success, flex: 1, padding: SPACING.sm, alignItems: 'center',
  },
  approveBtnText: { color: COLORS.success, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.caption },
  rejectBtn: {
    backgroundColor: COLORS.error + '11', borderRadius: BORDER_RADIUS.sm, borderWidth: 1,
    borderColor: COLORS.error, flex: 1, padding: SPACING.sm, alignItems: 'center',
  },
  rejectBtnText: { color: COLORS.error, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.caption },
  errorContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: SPACING.xl,
  },
  errorIcon: { fontSize: 48 },
  errorText: { color: COLORS.error, fontSize: FONT_SIZE.body, textAlign: 'center' },
  retryBtn: {
    backgroundColor: COLORS.gold, borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md, paddingHorizontal: SPACING.xl,
  },
  retryBtnText: { color: COLORS.background, fontWeight: FONT_WEIGHT.bold },
  empty: { flex: 1, alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, textAlign: 'center' },
  modalOverlay: {
    flex: 1, backgroundColor: alpha(colors.black, 0.53),
    alignItems: 'center', justifyContent: 'center', padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.lg, width: '100%', gap: SPACING.md,
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  modalActions: { flexDirection: 'row', gap: SPACING.sm },
  modalConfirmBtn: {
    flex: 1, backgroundColor: COLORS.error, borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md, alignItems: 'center',
  },
  modalConfirmBtnText: { color: COLORS.textPrimary, fontWeight: FONT_WEIGHT.bold },
});

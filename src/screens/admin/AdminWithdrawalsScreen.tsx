import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { getWithdrawals } from '../../services/marketplace/adminService';
import app from '../../core/firebase';
import { Withdrawal } from '../../shared/types/marketplace';

const STATUS_TABS = ['pending', 'approved', 'paid', 'rejected'] as const;
type StatusTab = typeof STATUS_TABS[number];

const STATUS_LABELS: Record<StatusTab, string> = {
  pending: 'Pendentes', approved: 'Aprovados', paid: 'Pagos', rejected: 'Rejeitados',
};

export default function AdminWithdrawalsScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<StatusTab>('pending');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const loadWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getWithdrawals(activeTab);
      setWithdrawals(result.withdrawals);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  React.useEffect(() => { loadWithdrawals(); }, [activeTab]);

  async function callFunction(fnName: string, params: object, successMsg: string) {
    try {
      const functions = getFunctions(app, 'us-central1');
      const fn = httpsCallable(functions, fnName);
      await fn(params);
      Alert.alert(successMsg);
      loadWithdrawals();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
  }

  async function handleApprove(w: Withdrawal) {
    Alert.alert('Aprovar saque?', `R$ ${w.amount.toFixed(2)} para ${w.pixKey}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprovar', onPress: async () => {
          setProcessing(w.id);
          await callFunction('onApproveWithdrawal', { withdrawalId: w.id }, '✅ Saque aprovado!');
          setProcessing(null);
        },
      },
    ]);
  }

  async function handleReject(w: Withdrawal) {
    Alert.prompt('Rejeitar saque', 'Motivo:', async (reason) => {
      if (!reason?.trim()) return;
      setProcessing(w.id);
      await callFunction('onRejectWithdrawal', { withdrawalId: w.id, reason }, '❌ Saque rejeitado');
      setProcessing(null);
    }, 'plain-text');
  }

  async function handleMarkPaid(w: Withdrawal) {
    Alert.alert('Confirmar pagamento?', `Marcar R$ ${w.amount.toFixed(2)} como pago?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar', onPress: async () => {
          setProcessing(w.id);
          await callFunction('onMarkWithdrawalPaid', { withdrawalId: w.id }, '✅ Saque marcado como pago!');
          setProcessing(null);
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
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
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {STATUS_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={withdrawals}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={loadWithdrawals} tintColor={colors.gold} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhum saque {STATUS_LABELS[activeTab].toLowerCase()}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.amount}>R$ {item.amount.toFixed(2)}</Text>
                <Text style={styles.date}>{item.createdAt.toLocaleDateString('pt-BR')}</Text>
              </View>
              <Text style={styles.pixInfo}>
                {item.pixType?.toUpperCase()}: {item.pixKey}
              </Text>
              <Text style={styles.userId}>UID: {item.userId.slice(0, 16)}...</Text>

              {processing === item.id ? (
                <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.sm }} />
              ) : activeTab === 'pending' ? (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
                    <Text style={styles.approveBtnText}>✅ Aprovar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
                    <Text style={styles.rejectBtnText}>❌ Rejeitar</Text>
                  </TouchableOpacity>
                </View>
              ) : activeTab === 'approved' ? (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.paidBtn} onPress={() => handleMarkPaid(item)}>
                    <Text style={styles.paidBtnText}>💸 Marcar como pago</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
                    <Text style={styles.rejectBtnText}>❌ Rejeitar</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {item.rejectionReason && (
                <Text style={styles.reason}>Motivo: {item.rejectionReason}</Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.grayDark },
  tab: { flex: 1, padding: spacing.sm, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabText: { color: colors.gray, fontSize: fonts.sizes.xs },
  tabTextActive: { color: colors.gold, fontWeight: 'bold' },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  amount: { color: colors.gold, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  date: { color: colors.gray, fontSize: fonts.sizes.sm },
  pixInfo: { color: colors.white, fontSize: fonts.sizes.md, marginBottom: spacing.xs },
  userId: { color: colors.gray, fontSize: fonts.sizes.xs, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
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
  reason: { color: colors.error, fontSize: fonts.sizes.xs, marginTop: spacing.sm },
  empty: { alignItems: 'center', padding: spacing.xl },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.md },
});
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getCreatorRequests } from '../../services/marketplace/adminService';
import app from '../../core/firebase';
import { CreatorRequest } from '../../services/marketplace/creatorService';
import { useAdminGuard } from '../../hooks/useAdminGuard';

const STATUS_TABS = ['pending', 'approved', 'rejected'] as const;
type StatusTab = typeof STATUS_TABS[number];

export default function AdminCreatorRequestsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { blocked, loading: guardLoading } = useAdminGuard();
  const [activeTab, setActiveTab] = useState<StatusTab>('pending');
  const [requests, setRequests] = useState<CreatorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCreatorRequests(activeTab);
      setRequests(result.requests as any);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  React.useEffect(() => { loadRequests(); }, [activeTab]);

  if (guardLoading || blocked) return null;

  async function handleApprove(request: CreatorRequest) {
    Alert.alert('Aprovar criador?', 'Confirmar aprovação?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprovar', onPress: async () => {
          setProcessing(request.id);
          try {
            const functions = getFunctions(app, 'us-central1');
            const approve = httpsCallable(functions, 'onApproveCreator');
            await approve({ requestId: request.id, userId: request.userId });
            Alert.alert('✅ Criador aprovado!');
            loadRequests();
          } catch (e: any) {
            Alert.alert('Erro', e.message);
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  }

  async function handleReject(request: CreatorRequest) {
    Alert.prompt('Rejeitar criador', 'Informe o motivo:', async (reason) => {
      if (!reason?.trim()) return;
      setProcessing(request.id);
      try {
        const functions = getFunctions(app, 'us-central1');
        const reject = httpsCallable(functions, 'onRejectCreator');
        await reject({ requestId: request.id, userId: request.userId, reason });
        Alert.alert('❌ Solicitação rejeitada');
        loadRequests();
      } catch (e: any) {
        Alert.alert('Erro', e.message);
      } finally {
        setProcessing(null);
      }
    }, 'plain-text');
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Solicitações de Criador</Text>
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
              {tab === 'pending' ? 'Pendentes' : tab === 'approved' ? 'Aprovados' : 'Rejeitados'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={loadRequests} tintColor={colors.gold} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhuma solicitação {activeTab}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardId}>UID: {item.userId.slice(0, 16)}...</Text>
              <Text style={styles.cardDate}>
                {item.createdAt.toLocaleDateString('pt-BR')}
              </Text>
              {activeTab === 'pending' && (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleApprove(item)}
                    disabled={processing === item.id}
                  >
                    {processing === item.id ? (
                      <ActivityIndicator color={colors.background} size="small" />
                    ) : (
                      <Text style={styles.approveBtnText}>✅ Aprovar</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleReject(item)}
                    disabled={processing === item.id}
                  >
                    <Text style={styles.rejectBtnText}>❌ Rejeitar</Text>
                  </TouchableOpacity>
                </View>
              )}
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
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.grayDark },
  tab: { flex: 1, padding: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabText: { color: colors.gray, fontSize: fonts.sizes.sm },
  tabTextActive: { color: colors.gold, fontWeight: 'bold' },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
  },
  cardId: { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.xs },
  cardDate: { color: colors.grayDark, fontSize: fonts.sizes.xs, marginBottom: spacing.sm },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
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
  reason: { color: colors.error, fontSize: fonts.sizes.sm, marginTop: spacing.sm },
  empty: { flex: 1, alignItems: 'center', padding: spacing.xl },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.md },
});
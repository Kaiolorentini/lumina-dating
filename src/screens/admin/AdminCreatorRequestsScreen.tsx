import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getCreatorRequests } from '../../services/marketplace/adminService';
import { getUserById } from '../../services/marketplace/adminService';
import app from '../../core/firebase';
import { CreatorRequest } from '../../services/marketplace/creatorService';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';

const STATUS_TABS = ['pending', 'approved', 'rejected'] as const;
type StatusTab = typeof STATUS_TABS[number];

export default function AdminCreatorRequestsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { blocked, loading: guardLoading } = useAdminGuard();
  const [activeTab, setActiveTab] = useState<StatusTab>('pending');
  const [requests, setRequests] = useState<CreatorRequest[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // ✅ Modal de rejeição — substitui Alert.prompt (iOS only)
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingRequest, setRejectingRequest] = useState<CreatorRequest | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCreatorRequests(activeTab);
      setRequests(result.requests);

      // Busca nomes dos usuários em paralelo
      const names: Record<string, string> = {};
      await Promise.all(
        result.requests.map(async req => {
          try {
            const profile = await getUserById(req.userId);
            names[req.userId] = profile?.name ?? req.userId.slice(0, 12) + '...';
          } catch {
            names[req.userId] = req.userId.slice(0, 12) + '...';
          }
        })
      );
      setUserNames(names);
    } catch (e: any) {
      console.error('[AdminCreatorRequests] Erro:', e);
      setError(e.message ?? 'Erro ao carregar solicitações');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  React.useEffect(() => { loadRequests(); }, [activeTab]);

  if (guardLoading || blocked) return null;

  async function handleApprove(req: CreatorRequest) {
    Alert.alert('Aprovar criador?', `Aprovar ${userNames[req.userId] || req.userId}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprovar',
        onPress: async () => {
          setProcessing(req.id);
          try {
            const functions = getFunctions(app, 'us-central1');
            const approve = httpsCallable(functions, 'onApproveCreator');
            await approve({ requestId: req.id, userId: req.userId });
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

  function openRejectModal(req: CreatorRequest) {
    setRejectingRequest(req);
    setRejectReason('');
    setRejectModal(true);
  }

  async function confirmReject() {
    if (!rejectingRequest) return;
    if (!rejectReason.trim()) {
      Alert.alert('Erro', 'Informe o motivo da rejeição.');
      return;
    }
    setRejectModal(false);
    setProcessing(rejectingRequest.id);
    try {
      const functions = getFunctions(app, 'us-central1');
      const reject = httpsCallable(functions, 'onRejectCreator');
      await reject({
        requestId: rejectingRequest.id,
        userId: rejectingRequest.userId,
        reason: rejectReason.trim(),
      });
      Alert.alert('❌ Solicitação rejeitada');
      loadRequests();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setProcessing(null);
      setRejectingRequest(null);
    }
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Solicitações de Criador</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
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

      {/* Conteúdo */}
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
            <RefreshControl
              refreshing={false}
              onRefresh={loadRequests}
              tintColor={colors.gold}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>
                Nenhuma solicitação {
                  activeTab === 'pending' ? 'pendente' :
                  activeTab === 'approved' ? 'aprovada' : 'rejeitada'
                }
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* Nome do usuário */}
              <Text style={styles.cardName}>
                👤 {userNames[item.userId] || item.userId.slice(0, 16) + '...'}
              </Text>
              <Text style={styles.cardId}>
                UID: {item.userId.slice(0, 20)}...
              </Text>
              <Text style={styles.cardDate}>
                📅 {item.createdAt.toLocaleDateString('pt-BR')} às{' '}
                {item.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
                    onPress={() => openRejectModal(item)}
                    disabled={processing === item.id}
                  >
                    <Text style={styles.rejectBtnText}>❌ Rejeitar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {item.rejectionReason && (
                <Text style={styles.reason}>
                  💬 Motivo: {item.rejectionReason}
                </Text>
              )}

              {item.reviewedAt && (
                <Text style={styles.reviewedAt}>
                  Revisado em: {item.reviewedAt.toLocaleDateString('pt-BR')}
                </Text>
              )}
            </View>
          )}
        />
      )}

      {/* ✅ Modal de rejeição — funciona no Android e iOS */}
      <Modal
        visible={rejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>❌ Rejeitar criador</Text>
            <Text style={styles.modalSubtitle}>
              {rejectingRequest && (userNames[rejectingRequest.userId] || rejectingRequest.userId.slice(0, 16))}
            </Text>
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
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRejectModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={confirmReject}
              >
                <Text style={styles.modalConfirmBtnText}>Confirmar</Text>
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
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.grayDark },
  tab: { flex: 1, padding: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabText: { color: colors.gray, fontSize: fonts.sizes.sm },
  tabTextActive: { color: colors.gold, fontWeight: 'bold' },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
    gap: spacing.xs,
  },
  cardName: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  cardId: { color: colors.gray, fontSize: fonts.sizes.xs },
  cardDate: { color: colors.gray, fontSize: fonts.sizes.xs },
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
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
  reason: { color: colors.error, fontSize: fonts.sizes.sm, marginTop: spacing.xs },
  reviewedAt: { color: colors.gray, fontSize: fonts.sizes.xs },
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
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: '#00000088',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.lg, width: '100%', gap: spacing.md,
  },
  modalTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  modalSubtitle: { color: colors.gray, fontSize: fonts.sizes.sm },
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
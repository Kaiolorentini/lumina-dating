import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Input } from '../../components/ui';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha , colors } from '../../theme/tokens';
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
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
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
            <RefreshControl
              refreshing={false}
              onRefresh={loadRequests}
              tintColor={COLORS.gold}
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
                      <ActivityIndicator color={COLORS.background} size="small" />
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
              <Button label="Confirmar" variant="primary" onPress={confirmReject} />
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
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  tab: { flex: 1, padding: SPACING.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.gold },
  tabText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  tabTextActive: { color: COLORS.gold, fontWeight: FONT_WEIGHT.bold },
  list: { padding: SPACING.md },
  card: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  cardName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  cardId: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  cardDate: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  cardActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
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
  reason: { color: COLORS.error, fontSize: FONT_SIZE.caption, marginTop: SPACING.xs },
  reviewedAt: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
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
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: alpha(colors.black, 0.53),
    alignItems: 'center', justifyContent: 'center', padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.lg, width: '100%', gap: SPACING.md,
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  modalSubtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  modalActions: { flexDirection: 'row', gap: SPACING.sm },
});

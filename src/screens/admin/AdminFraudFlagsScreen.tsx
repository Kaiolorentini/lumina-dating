import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput, Modal,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { getFraudFlags, getUserById } from '../../services/marketplace/adminService';
import { FraudFlag, FraudReason, FraudStatus } from '../../shared/types/marketplace';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import app from '../../core/firebase';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_TABS: FraudStatus[] = ['open', 'reviewing', 'resolved', 'dismissed'];

const STATUS_LABEL: Record<FraudStatus, string> = {
  open: 'Abertas',
  reviewing: 'Em análise',
  resolved: 'Resolvidas',
  dismissed: 'Descartadas',
};

const REASON_LABEL: Record<FraudReason, string> = {
  chargeback: 'Chargeback',
  spam: 'Spam',
  multiaccount: 'Multi-conta',
  abuse: 'Abuso',
  piracy: 'Pirataria',
  suspicious_activity: 'Atividade suspeita',
};

function reasonText(reason: FraudReason): string {
  return REASON_LABEL[reason] ?? reason;
}

function formatDate(value: any): string {
  try {
    const d = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
    if (!d) return '';
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return '';
  }
}

export default function AdminFraudFlagsScreen() {
  const navigation = useNavigation<NavProp>();
  const { blocked, loading: guardLoading } = useAdminGuard();
  const [activeTab, setActiveTab] = useState<FraudStatus>('open');
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Modal de bloqueio
  const [blockModal, setBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getFraudFlags(activeTab, 20);
      setFlags(result.flags);

      const names: Record<string, string> = {};
      await Promise.all(
        result.flags.map(async flag => {
          try {
            const profile = await getUserById(flag.userId);
            names[flag.userId] = profile?.name ?? flag.userId.slice(0, 12) + '...';
          } catch {
            names[flag.userId] = flag.userId.slice(0, 12) + '...';
          }
        })
      );
      setUserNames(names);
    } catch (e: any) {
      console.error('[AdminFraudFlags] Erro:', e);
      setError(e.message ?? 'Erro ao carregar sinalizações');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  React.useEffect(() => { loadFlags(); }, [activeTab]);

  if (guardLoading || blocked) return null;

  async function handleResolve(flag: FraudFlag, newStatus: 'reviewing' | 'resolved' | 'dismissed') {
    const labels: Record<string, string> = {
      reviewing: 'marcar como Em análise',
      resolved: 'Resolver',
      dismissed: 'Descartar',
    };
    Alert.alert('Confirmar', `Deseja ${labels[newStatus]} esta sinalização?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          setProcessing(flag.id);
          try {
            const functions = getFunctions(app, 'us-central1');
            const fn = httpsCallable(functions, 'resolveFraudFlag');
            await fn({ flagId: flag.id, newStatus });
            Alert.alert('✅ Status atualizado');
            loadFlags();
          } catch (e: any) {
            Alert.alert('Erro', e.message);
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  }

  function openBlockModal(userId: string) {
    setBlockingUserId(userId);
    setBlockReason('');
    setBlockModal(true);
  }

  async function confirmBlock() {
    if (!blockingUserId) return;
    if (!blockReason.trim()) {
      Alert.alert('Erro', 'Informe o motivo do bloqueio.');
      return;
    }
    setBlockModal(false);
    setProcessing(blockingUserId);
    try {
      const functions = getFunctions(app, 'us-central1');
      const block = httpsCallable(functions, 'blockUser');
      await block({ userId: blockingUserId, reason: blockReason.trim() });
      Alert.alert('✅ Usuário bloqueado');
      loadFlags();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setProcessing(null);
      setBlockingUserId(null);
    }
  }

  function renderActions(flag: FraudFlag) {
    // Abas finais (resolved/dismissed) → só leitura
    if (activeTab === 'resolved' || activeTab === 'dismissed') {
      return (
        <View style={styles.reviewedInfo}>
          <Text style={styles.reviewedText}>
            {flag.reviewedAt ? `Revisado em ${formatDate(flag.reviewedAt)}` : 'Revisado'}
          </Text>
        </View>
      );
    }

    const isProcessing = processing === flag.id || processing === flag.userId;

    return (
      <View style={styles.actionsWrap}>
        {/* Ver perfil — sempre */}
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => navigation.navigate('AdminUserDetail', { userId: flag.userId })}
          disabled={isProcessing}
        >
          <Text style={styles.profileBtnText}>👤 Ver perfil</Text>
        </TouchableOpacity>

        {/* Em análise — só na aba open */}
        {activeTab === 'open' && (
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() => handleResolve(flag, 'reviewing')}
            disabled={isProcessing}
          >
            <Text style={styles.reviewBtnText}>🔍 Em análise</Text>
          </TouchableOpacity>
        )}

        {/* Resolver — open e reviewing */}
        <TouchableOpacity
          style={styles.resolveBtn}
          onPress={() => handleResolve(flag, 'resolved')}
          disabled={isProcessing}
        >
          <Text style={styles.resolveBtnText}>✅ Resolver</Text>
        </TouchableOpacity>

        {/* Descartar — open e reviewing */}
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={() => handleResolve(flag, 'dismissed')}
          disabled={isProcessing}
        >
          <Text style={styles.dismissBtnText}>🗑️ Descartar</Text>
        </TouchableOpacity>

        {/* Bloquear usuário — open e reviewing */}
        <TouchableOpacity
          style={styles.blockBtn}
          onPress={() => openBlockModal(flag.userId)}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color={colors.error} size="small" />
          ) : (
            <Text style={styles.blockBtnText}>🚫 Bloquear usuário</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sinalizações de Fraude</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs — scroll horizontal (são 4) */}
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

      {/* Conteúdo */}
      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadFlags}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={flags}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={loadFlags} tintColor={colors.gold} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🛡️</Text>
              <Text style={styles.emptyText}>
                Nenhuma sinalização {STATUS_LABEL[activeTab].toLowerCase()}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.reasonBadge}>
                  <Text style={styles.reasonBadgeText}>{reasonText(item.reason)}</Text>
                </View>
                <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
              </View>

              <Text style={styles.cardUser}>
                👤 {userNames[item.userId] || item.userId.slice(0, 16) + '...'}
              </Text>
              <Text style={styles.cardUid}>UID: {item.userId.slice(0, 24)}...</Text>

              {item.description ? (
                <Text style={styles.cardDescription}>{item.description}</Text>
              ) : null}

              {item.relatedSaleId ? (
                <Text style={styles.cardSale}>🧾 Venda: {item.relatedSaleId}</Text>
              ) : null}

              {renderActions(item)}
            </View>
          )}
        />
      )}

      {/* Modal de bloqueio */}
      <Modal
        visible={blockModal}
        transparent
        animationType="fade"
        onRequestClose={() => setBlockModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🚫 Bloquear usuário</Text>
            <Text style={styles.modalSubtitle}>
              {blockingUserId && (userNames[blockingUserId] || blockingUserId.slice(0, 16))}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Informe o motivo do bloqueio..."
              placeholderTextColor={colors.gray}
              value={blockReason}
              onChangeText={setBlockReason}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setBlockModal(false)}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmBlock}>
                <Text style={styles.modalConfirmBtnText}>Bloquear</Text>
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
  reasonBadge: {
    backgroundColor: colors.error + '22', borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.error,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  reasonBadgeText: { color: colors.error, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  cardDate: { color: colors.gray, fontSize: fonts.sizes.xs },
  cardUser: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', marginTop: spacing.xs },
  cardUid: { color: colors.gray, fontSize: fonts.sizes.xs },
  cardDescription: { color: colors.gray, fontSize: fonts.sizes.sm, marginTop: spacing.xs, lineHeight: 20 },
  cardSale: { color: colors.gold, fontSize: fonts.sizes.xs, marginTop: spacing.xs },
  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  profileBtn: {
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.grayDark,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  profileBtnText: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  reviewBtn: {
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.gold,
    backgroundColor: colors.gold + '11',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  reviewBtnText: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  resolveBtn: {
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.success,
    backgroundColor: colors.success + '22',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  resolveBtnText: { color: colors.success, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  dismissBtn: {
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.grayDark,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  dismissBtnText: { color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  blockBtn: {
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.error,
    backgroundColor: colors.error + '11',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  blockBtnText: { color: colors.error, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  reviewedInfo: { marginTop: spacing.sm },
  reviewedText: { color: colors.gray, fontSize: fonts.sizes.xs, fontStyle: 'italic' },
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
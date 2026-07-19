import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Modal,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Input } from '../../components/ui';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha , colors } from '../../theme/tokens';
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
            <ActivityIndicator color={COLORS.error} size="small" />
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
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
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
        <ActivityIndicator color={COLORS.gold} style={{ flex: 1 }} />
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
            <RefreshControl refreshing={false} onRefresh={loadFlags} tintColor={COLORS.gold} />
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
            <Input
              placeholder="Informe o motivo do bloqueio..."
              value={blockReason}
              onChangeText={setBlockReason}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button label="Cancelar" variant="ghost" onPress={() => setBlockModal(false)} />
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
  reasonBadge: {
    backgroundColor: COLORS.error + '22', borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.error,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  reasonBadgeText: { color: COLORS.error, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  cardDate: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  cardUser: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.xs },
  cardUid: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  cardDescription: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, marginTop: SPACING.xs, lineHeight: 20 },
  cardSale: { color: COLORS.gold, fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  profileBtn: {
    borderRadius: BORDER_RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  profileBtnText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  reviewBtn: {
    borderRadius: BORDER_RADIUS.sm, borderWidth: 1, borderColor: COLORS.gold,
    backgroundColor: COLORS.gold + '11',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  reviewBtnText: { color: COLORS.gold, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  resolveBtn: {
    borderRadius: BORDER_RADIUS.sm, borderWidth: 1, borderColor: COLORS.success,
    backgroundColor: COLORS.success + '22',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  resolveBtnText: { color: COLORS.success, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  dismissBtn: {
    borderRadius: BORDER_RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  dismissBtnText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  blockBtn: {
    borderRadius: BORDER_RADIUS.sm, borderWidth: 1, borderColor: COLORS.error,
    backgroundColor: COLORS.error + '11',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  blockBtnText: { color: COLORS.error, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  reviewedInfo: { marginTop: SPACING.sm },
  reviewedText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontStyle: 'italic' },
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
  modalConfirmBtn: {
    flex: 1, backgroundColor: COLORS.error, borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md, alignItems: 'center',
  },
  modalConfirmBtnText: { color: COLORS.textPrimary, fontWeight: FONT_WEIGHT.bold },
});

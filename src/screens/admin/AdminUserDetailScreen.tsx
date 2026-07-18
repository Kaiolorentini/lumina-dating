import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { getUserById, getScreenshotEvents } from '../../services/marketplace/adminService';
import app from '../../core/firebase';
import { UserProfile } from '../../shared/types';
import { useSuperAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';

type RouteProps = RouteProp<RootStackParamList, 'AdminUserDetail'>;

export default function AdminUserDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { userId } = route.params;
  const { user } = useAuth();
  const { isSuperAdmin } = useUserPermissions(user?.uid);
  const { blocked, loading: guardLoading } = useSuperAdminGuard();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // ✅ Modal de bloqueio — funciona no Android e iOS (Alert.prompt é iOS-only)
  const [blockModal, setBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    loadData();
  }, [userId]);

  if (guardLoading || blocked) return null;

  async function loadData() {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        getUserById(userId),
        getScreenshotEvents(userId),
      ]);
      setProfile(p);
      setScreenshots(s);
    } finally {
      setLoading(false);
    }
  }

  function openBlockModal() {
    setBlockReason('');
    setBlockModal(true);
  }

  async function confirmBlock() {
    if (!blockReason.trim()) {
      Alert.alert('Erro', 'Informe o motivo do bloqueio.');
      return;
    }
    setBlockModal(false);
    setProcessing(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const block = httpsCallable(functions, 'blockUser');
      await block({ userId, reason: blockReason.trim() });
      Alert.alert('✅ Usuário bloqueado');
      loadData();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleUnblock() {
    Alert.alert('Desbloquear usuário?', 'Confirmar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desbloquear', onPress: async () => {
          setProcessing(true);
          try {
            const functions = getFunctions(app, 'us-central1');
            const unblock = httpsCallable(functions, 'unblockUser');
            await unblock({ userId });
            Alert.alert('✅ Usuário desbloqueado');
            loadData();
          } catch (e: any) {
            Alert.alert('Erro', e.message);
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <ScreenContainer style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </ScreenContainer>
    );
  }

  const isBlocked = (profile as any)?.isBlocked;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes do Usuário</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Perfil</Text>
          <Text style={styles.field}>Nome: <Text style={styles.value}>{profile?.name ?? '—'}</Text></Text>
          <Text style={styles.field}>Email: <Text style={styles.value}>{profile?.email ?? '—'}</Text></Text>
          <Text style={styles.field}>UID: <Text style={styles.value}>{userId}</Text></Text>
          <Text style={styles.field}>Role: <Text style={styles.value}>{(profile as any)?.role ?? 'user'}</Text></Text>
          <Text style={styles.field}>Status: <Text style={[styles.value, isBlocked && { color: colors.error }]}>
            {isBlocked ? '🚫 Bloqueado' : '✅ Ativo'}
          </Text></Text>
          {isBlocked && (
            <Text style={styles.field}>Motivo: <Text style={styles.value}>{(profile as any)?.blockedReason}</Text></Text>
          )}
        </View>

        {screenshots.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📸 Eventos de Screenshot ({screenshots.length})</Text>
            {screenshots.slice(0, 5).map((s, i) => (
              <Text key={i} style={styles.field}>
                Print {s.warningNumber} — {s.createdAt.toLocaleDateString('pt-BR')}
              </Text>
            ))}
          </View>
        )}

        {isSuperAdmin && (
          <View style={styles.actionsCard}>
            <Text style={styles.cardTitle}>⚡ Ações</Text>
            {processing ? (
              <ActivityIndicator color={colors.gold} />
            ) : isBlocked ? (
              <TouchableOpacity style={styles.unblockBtn} onPress={handleUnblock}>
                <Text style={styles.unblockBtnText}>✅ Desbloquear usuário</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.blockBtn} onPress={openBlockModal}>
                <Text style={styles.blockBtnText}>🚫 Bloquear usuário</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* ✅ Modal de bloqueio — Android + iOS */}
      <Modal
        visible={blockModal}
        transparent
        animationType="fade"
        onRequestClose={() => setBlockModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🚫 Bloquear usuário</Text>
            <Text style={styles.modalSubtitle}>{profile?.name ?? userId.slice(0, 16)}</Text>
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
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  content: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
  },
  actionsCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.error + '44', padding: spacing.md, marginBottom: spacing.md,
  },
  cardTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', marginBottom: spacing.sm },
  field: { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.xs },
  value: { color: colors.white },
  blockBtn: {
    backgroundColor: colors.error + '22', borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.error, padding: spacing.md, alignItems: 'center',
  },
  blockBtnText: { color: colors.error, fontWeight: 'bold', fontSize: fonts.sizes.md },
  unblockBtn: {
    backgroundColor: colors.success + '22', borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.success, padding: spacing.md, alignItems: 'center',
  },
  unblockBtnText: { color: colors.success, fontWeight: 'bold', fontSize: fonts.sizes.md },
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
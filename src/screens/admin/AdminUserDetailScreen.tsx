import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Button, Card, Input } from '../../components/ui';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha , colors } from '../../theme/tokens';
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
        <ActivityIndicator color={COLORS.gold} />
      </ScreenContainer>
    );
  }

  const isBlocked = (profile as any)?.isBlocked;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
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
          <Text style={styles.field}>Status: <Text style={[styles.value, isBlocked && { color: COLORS.error }]}>
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
              <ActivityIndicator color={COLORS.gold} />
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
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  content: { padding: SPACING.md },
  card: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.md,
  },
  actionsCard: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.error + '44', padding: SPACING.md, marginBottom: SPACING.md,
  },
  cardTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm },
  field: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, marginBottom: SPACING.xs },
  value: { color: COLORS.textPrimary },
  blockBtn: {
    backgroundColor: COLORS.error + '22', borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.error, padding: SPACING.md, alignItems: 'center',
  },
  blockBtnText: { color: COLORS.error, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.body },
  unblockBtn: {
    backgroundColor: COLORS.success + '22', borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.success, padding: SPACING.md, alignItems: 'center',
  },
  unblockBtnText: { color: COLORS.success, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.body },
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

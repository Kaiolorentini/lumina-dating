import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
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

type RouteProps = RouteProp<RootStackParamList, 'AdminUserDetail'>;

export default function AdminUserDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { userId } = route.params;
  const { user } = useAuth();
  const { isSuperAdmin } = useUserPermissions(user?.uid);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId]);

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

  async function handleBlock() {
    Alert.prompt('Bloquear usuário', 'Motivo do bloqueio:', async (reason) => {
      if (!reason?.trim()) return;
      setProcessing(true);
      try {
        const functions = getFunctions(app, 'us-central1');
        const block = httpsCallable(functions, 'blockUser');
        await block({ userId, reason });
        Alert.alert('✅ Usuário bloqueado');
        loadData();
      } catch (e: any) {
        Alert.alert('Erro', e.message);
      } finally {
        setProcessing(false);
      }
    }, 'plain-text');
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

  if (loading) return <ActivityIndicator color={colors.gold} style={{ flex: 1, backgroundColor: colors.background }} />;

  const isBlocked = (profile as any)?.isBlocked;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes do Usuário</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Perfil */}
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

        {/* Screenshots */}
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

        {/* Ações — apenas SuperAdmin */}
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
              <TouchableOpacity style={styles.blockBtn} onPress={handleBlock}>
                <Text style={styles.blockBtnText}>🚫 Bloquear usuário</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
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
});
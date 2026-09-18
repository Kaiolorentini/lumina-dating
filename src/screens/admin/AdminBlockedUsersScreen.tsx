// ============================================
// LUMINA — BLOQUEADOS POR FRAUDE
// src/screens/admin/AdminBlockedUsersScreen.tsx
//
// Lista quem foi punido pela tela de fraudes.
// A ação de desbloquear NÃO vive aqui: tocar no
// card leva ao AdminUserDetail, que já tem o botão
// e mostra o histórico completo do usuário. Dois
// códigos de desbloqueio seria dívida garantida.
//
// Os dados vêm da CF listBlockedUsers, nunca de
// query direta em users — o documento guarda email
// e pushToken, que não devem sair do servidor.
// ============================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useSuperAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';
import app from '../../core/firebase';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Genérico extraído para tipo nomeado: httpsCallable< em
// fim de linha é corrompido ao colar.
interface BlockedUserRow {
  uid: string;
  name: string | null;
  role: string;
  previousRole: string | null;
  blockedReason: string | null;
  blockedAt: string | null;
  blockedBy: string | null;
  marketplaceBanUntil: string | null;
  expired: boolean;
}

interface ListBlockedResult {
  users: BlockedUserRow[];
}

function formatIso(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  })}`;
}

export default function AdminBlockedUsersScreen() {
  const navigation = useNavigation<NavProp>();
  const { blocked, loading: guardLoading } = useSuperAdminGuard();
  const [rows, setRows] = useState<BlockedUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const functions = getFunctions(app, 'us-central1');
      const fn = httpsCallable<void, ListBlockedResult>(functions, 'listBlockedUsers');
      const result = await fn();
      setRows(result.data.users);
    } catch (e: any) {
      console.error('[AdminBlockedUsers] Erro:', e);
      setError(e.message ?? 'Erro ao carregar bloqueados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Recarrega ao voltar do AdminUserDetail: sem isto, quem
  // acabou de ser desbloqueado continuaria na lista.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (guardLoading || blocked) return null;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bloqueados por Fraude</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.uid}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={load} tintColor={colors.gold} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyIcon}>🛡️</Text>
              <Text style={styles.emptyText}>
                Nenhum usuário bloqueado por fraude
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('AdminUserDetail', { userId: item.uid })}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardName} numberOfLines={1}>
                  👤 {item.name ?? item.uid.slice(0, 16) + '...'}
                </Text>
                <Text style={styles.cardArrow}>›</Text>
              </View>

              <Text style={styles.cardUid}>UID: {item.uid.slice(0, 24)}...</Text>

              {item.blockedReason ? (
                <Text style={styles.cardReason}>{item.blockedReason}</Text>
              ) : null}

              <Text style={styles.cardMeta}>
                Bloqueado em {formatIso(item.blockedAt)}
              </Text>

              {item.previousRole ? (
                <Text style={styles.cardRole}>
                  Era {item.previousRole} — o papel volta ao expirar
                </Text>
              ) : null}

              <View style={styles.badgeRow}>
                {item.marketplaceBanUntil === null ? (
                  <View style={[styles.badge, styles.badgeIndef]}>
                    <Text style={[styles.badgeText, styles.badgeIndefText]}>
                      Indefinido
                    </Text>
                  </View>
                ) : item.expired ? (
                  // O prazo venceu, mas a restauração é assíncrona:
                  // acontece quando a pessoa abrir o app ou na
                  // varredura diária das 04:10.
                  <View style={[styles.badge, styles.badgeExpired]}>
                    <Text style={[styles.badgeText, styles.badgeExpiredText]}>
                      Prazo vencido — restauração pendente
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.badge, styles.badgeActive]}>
                    <Text style={[styles.badgeText, styles.badgeActiveText]}>
                      Até {formatIso(item.marketplaceBanUntil)}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
    gap: spacing.xs,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', flex: 1 },
  cardArrow: { color: colors.gold, fontSize: fonts.sizes.lg },
  cardUid: { color: colors.gray, fontSize: fonts.sizes.xs },
  cardReason: { color: colors.gray, fontSize: fonts.sizes.sm, lineHeight: 20, marginTop: spacing.xs },
  cardMeta: { color: colors.gray, fontSize: fonts.sizes.xs },
  cardRole: { color: colors.gold, fontSize: fonts.sizes.xs },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  badge: {
    borderRadius: borderRadius.sm, borderWidth: 1,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  badgeText: { fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  badgeActive: { borderColor: colors.error, backgroundColor: colors.error + '22' },
  badgeActiveText: { color: colors.error },
  badgeIndef: { borderColor: colors.gray, backgroundColor: colors.grayDark },
  badgeIndefText: { color: colors.white },
  badgeExpired: { borderColor: colors.success, backgroundColor: colors.success + '22' },
  badgeExpiredText: { color: colors.success },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
  errorIcon: { fontSize: 48 },
  errorText: { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.sm,
    padding: spacing.md, paddingHorizontal: spacing.xl,
  },
  retryBtnText: { color: colors.background, fontWeight: 'bold' },
});
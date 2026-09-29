// ============================================
// LUMINA — SUPORTE (ADMIN) — fila de chamados
// src/screens/admin/AdminSupportScreen.tsx
//
// Aguardando você (open) · Respondidos (answered) · Resolvidos.
// Urgentes sempre no topo; depois, a última mensagem mais recente.
// O toque abre a conversa (SupportTicket) em modo admin.
// ============================================

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';
import { categoryById } from '../../modules/support/supportQuestionnaire';
import {
  listenTicketsByStatus, SupportTicket, TicketStatus,
} from '../../modules/support/services/supportService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const TABS: { status: TicketStatus; label: string }[] = [
  { status: 'open',     label: 'Aguardando você' },
  { status: 'answered', label: 'Respondidos' },
  { status: 'resolved', label: 'Resolvidos' },
];

const PRIORITY_RANK = { urgent: 0, normal: 1, low: 2 } as const;

function timeAgo(d: Date | null): string {
  if (!d) return '';
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function AdminSupportScreen() {
  const navigation = useNavigation<NavProp>();
  const { blocked, loading: guardLoading } = useAdminGuard();

  const [tab, setTab]         = useState<TicketStatus>('open');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (guardLoading || blocked) return;
    setLoading(true);
    return listenTicketsByStatus(
      tab,
      list => {
        const sorted = [...list].sort((a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0));
        setTickets(sorted);
        setLoading(false);
        setError(null);
      },
      () => { setError('Não foi possível carregar os chamados.'); setLoading(false); },
    );
  }, [tab, guardLoading, blocked]);

  if (guardLoading || blocked) return null;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suporte</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t.status} style={[styles.tab, tab === t.status && styles.tabActive]} onPress={() => setTab(t.status)} accessibilityRole="tab">
            <Text style={[styles.tabText, tab === t.status && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.empty}><Text style={styles.errorText}>⚠️ {error}</Text></View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🆘</Text>
              <Text style={styles.emptyText}>Nenhum chamado nesta aba.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cat = categoryById(item.category);
            return (
              <TouchableOpacity
                style={[styles.card, item.priority === 'urgent' && styles.cardUrgent]}
                onPress={() => navigation.navigate('SupportTicket', { ticketId: item.id })}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{cat?.icon ?? '🆘'} {item.categoryLabel}</Text>
                  {item.unreadForAdmin && <View style={styles.dot} />}
                </View>
                {item.priority === 'urgent' && <Text style={styles.urgent}>🚨 URGENTE</Text>}
                {item.summary ? <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text> : null}
                <View style={styles.cardBottom}>
                  <Text style={styles.user} numberOfLines={1}>👤 {item.userName || 'Usuário'}</Text>
                  <Text style={styles.time}>{timeAgo(item.lastMessageAt)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
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
  backBtn:     { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  tabs:        { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.grayDark },
  tab:         { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
  tabActive:   { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabText:     { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },
  tabTextActive: { color: colors.gold, fontWeight: 'bold' },
  list:        { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.sm, gap: 4,
  },
  cardUrgent:  { borderColor: colors.error },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle:   { flex: 1, color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  dot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  urgent:      { color: colors.error, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  summary:     { color: colors.gray, fontSize: fonts.sizes.sm },
  cardBottom:  { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  user:        { flex: 1, color: colors.white, fontSize: fonts.sizes.xs },
  time:        { color: colors.gray, fontSize: fonts.sizes.xs },
  empty:       { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyIcon:   { fontSize: 44 },
  emptyText:   { color: colors.gray, fontSize: fonts.sizes.md },
  errorText:   { color: colors.error, fontSize: fonts.sizes.md, textAlign: 'center' },
});
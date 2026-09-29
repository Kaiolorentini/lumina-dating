// ============================================
// LUMINA — SUPORTE (início)
// src/modules/support/screens/SupportHomeScreen.tsx
//
// O chamado em andamento em destaque, o histórico e "Abrir
// chamado" — bloqueado enquanto houver um ativo (regra do servidor).
// ============================================

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { categoryById } from '../supportQuestionnaire';
import { listenMyTickets, SupportTicket, STATUS_LABEL } from '../services/supportService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_COLOR = { open: colors.gold, answered: colors.success, resolved: colors.gray } as const;

function formatDate(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR') : '';
}

export default function SupportHomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    return listenMyTickets(
      user.uid,
      list => { setTickets(list); setLoading(false); setError(null); },
      () => { setError('Não foi possível carregar seus chamados.'); setLoading(false); },
    );
  }, [user?.uid]);

  const active  = tickets.find(t => t.status !== 'resolved') ?? null;
  const history = tickets.filter(t => t.id !== active?.id);

  function renderTicket(t: SupportTicket, highlight = false) {
    const cat = categoryById(t.category);
    return (
      <TouchableOpacity
        key={t.id}
        style={[styles.card, highlight && styles.cardActive]}
        onPress={() => navigation.navigate('SupportTicket', { ticketId: t.id })}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>{cat?.icon ?? '🆘'} {t.categoryLabel}</Text>
          {t.unreadForUser && <View style={styles.dot} />}
        </View>
        {t.summary ? <Text style={styles.cardSummary} numberOfLines={2}>{t.summary}</Text> : null}
        <View style={styles.cardBottom}>
          <Text style={[styles.status, { color: STATUS_COLOR[t.status] }]}>{STATUS_LABEL[t.status]}</Text>
          <Text style={styles.date}>{formatDate(t.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Suporte" showBack showHome />

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={history}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <>
              <View style={styles.hero}>
                <Text style={styles.heroIcon}>🆘</Text>
                <Text style={styles.heroTitle}>Como podemos ajudar?</Text>
                <Text style={styles.heroSub}>
                  Responda algumas perguntas tocando nas opções — assim entendemos seu caso mais rápido.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, !!active && styles.primaryBtnDisabled]}
                  onPress={() => navigation.navigate('SupportNew')}
                  disabled={!!active}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryText}>Abrir chamado</Text>
                </TouchableOpacity>
                {active && (
                  <Text style={styles.activeHint}>
                    Você já tem um chamado em andamento. Novos chamados ficam disponíveis quando ele for resolvido.
                  </Text>
                )}
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              {active && (
                <>
                  <Text style={styles.section}>Em andamento</Text>
                  {renderTicket(active, true)}
                </>
              )}

              {history.length > 0 && <Text style={styles.section}>Histórico</Text>}
            </>
          }
          renderItem={({ item }) => renderTicket(item)}
          ListEmptyComponent={
            !active ? <Text style={styles.empty}>Você ainda não abriu nenhum chamado.</Text> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content:   { padding: spacing.md, paddingBottom: spacing.xl },
  hero: {
    alignItems: 'center', padding: spacing.lg, gap: spacing.sm, borderRadius: borderRadius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.gold + '44',
  },
  heroIcon:  { fontSize: 44 },
  heroTitle: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  heroSub:   { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center', lineHeight: 20 },
  primaryBtn: {
    marginTop: spacing.sm, backgroundColor: colors.gold, borderRadius: borderRadius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
  activeHint:  { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center' },
  error:       { color: colors.error, fontSize: fonts.sizes.sm, textAlign: 'center', marginTop: spacing.md },
  section: {
    color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold', textTransform: 'uppercase',
    letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.sm, gap: 4,
  },
  cardActive:  { borderColor: colors.gold },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle:   { flex: 1, color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  dot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  cardSummary: { color: colors.gray, fontSize: fonts.sizes.sm },
  cardBottom:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  status:      { fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  date:        { color: colors.gray, fontSize: fonts.sizes.xs },
  empty:       { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center', marginTop: spacing.lg },
});
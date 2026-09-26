// ============================================
// LUMINA — RANKING SCREEN v5.1
// src/modules/engagement/screens/RankingScreen.tsx
//
// Dois rankings: Social (competitivo) + Progressão (informativo)
// Top 50 com posição do usuário destacada
// ============================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Image,
  RefreshControl,
} from 'react-native';
import { LinearGradient }   from 'expo-linear-gradient';
import { useNavigation }    from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }          from '../../../context/AuthContext';
import { useRanking, RankingEntry } from '../hooks/useRanking';
import { useXP }        from '../hooks/useXP';
import { usePrestige }  from '../hooks/usePrestige';
import { useXPHistory, labelForAction } from '../hooks/useXPHistory';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const LEAGUE_COLORS: Record<string, string> = {
  'Galáxia':     '#B57BEE',
  'Constelação': '#FFD700',
  'Ouro':        '#FFA500',
  'Prata':       '#C0C0C0',
  'Bronze':      '#CD7F32',
};

const POSITION_ICONS: Record<number, string> = {
  1: '🏆',
  2: '🥈',
  3: '🥉',
};

const REWARDS: Record<number, number> = {
  1: 50, 2: 40, 3: 30,
};

type Tab = 'social' | 'progresso';

function RankingRow({
  entry,
  isCurrentUser,
  onPress,
}: {
  entry:         RankingEntry;
  isCurrentUser: boolean;
  onPress:       () => void;
}) {
  const leagueColor  = LEAGUE_COLORS[entry.league] ?? COLORS.textMuted;
  const positionIcon = POSITION_ICONS[entry.position];
  const reward       = REWARDS[entry.position];

  return (
    <TouchableOpacity
      style={[
        styles.row,
        isCurrentUser && styles.rowCurrent,
        entry.position <= 3 && styles.rowTop3,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Posição */}
      <View style={styles.positionBox}>
        {positionIcon
          ? <Text style={styles.positionIcon}>{positionIcon}</Text>
          : <Text style={[styles.positionNumber, isCurrentUser && { color: COLORS.secondary }]}>
              {entry.position}
            </Text>
        }
      </View>

      {/* Avatar */}
      {entry.photoURL ? (
        <Image source={{ uri: entry.photoURL }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={{ fontSize: 18 }}>👤</Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, isCurrentUser && { color: COLORS.secondary }]} numberOfLines={1}>
            {isCurrentUser ? `${entry.displayName} (você)` : entry.displayName}
          </Text>
          <View style={[styles.leagueBadge, { backgroundColor: leagueColor + '22', borderColor: leagueColor }]}>
            <Text style={[styles.leagueText, { color: leagueColor }]}>{entry.league}</Text>
          </View>
        </View>
        <Text style={styles.xp}>{entry.socialXP} XP Social</Text>
      </View>

      {/* Recompensa */}
      {reward && (
        <Text style={styles.reward}>+{reward}🔮</Text>
      )}
    </TouchableOpacity>
  );
}

export default function RankingScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { data, loading, error, refresh } = useRanking(user?.uid);
  const { status: xp }        = useXP(user?.uid);
  const { data: prestige }    = usePrestige(user?.uid);
  const { entries: history }  = useXPHistory(user?.uid);
  const [activeTab,   setActiveTab]   = useState<Tab>('social');
  const [refreshing, setRefreshing]   = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Ranking Semanal" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  const top50 = data?.top50 ?? [];

  return (
    <View style={styles.container}>
      <Header title="Ranking Semanal" showBack={true} showHome={true} />

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'social' && styles.tabActive]}
          onPress={() => setActiveTab('social')}
        >
          <Text style={[styles.tabText, activeTab === 'social' && styles.tabTextActive]}>
            🏆 Social
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'progresso' && styles.tabActive]}
          onPress={() => setActiveTab('progresso')}
        >
          <Text style={[styles.tabText, activeTab === 'progresso' && styles.tabTextActive]}>
            📈 Progressão
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.secondary} />}
      >
        {activeTab === 'social' && (
          <>
            {/* Sua posição */}
            {data?.userPosition ? (
              <LinearGradient colors={['#1A0A2E', '#2D1B4E']} style={styles.userCard}>
                <Text style={styles.userCardLabel}>Sua posição</Text>
                <Text style={styles.userPosition}>#{data.userPosition}</Text>
                <Text style={styles.userXP}>{data.userXP} XP Social</Text>
                {data.xpToNextPosition > 0 && (
                  <Text style={styles.userHint}>
                    +{data.xpToNextPosition} XP para subir uma posição
                  </Text>
                )}
              </LinearGradient>
            ) : (
              <LinearGradient colors={['#1A0A2E', '#2D1B4E']} style={styles.userCard}>
                <Text style={styles.userCardLabel}>Você ainda não está no ranking</Text>
                <Text style={styles.userHint}>
                  {data?.xpToTop50
                    ? `+${data.xpToTop50} XP para entrar no Top 50`
                    : 'Complete missões e interaja para ganhar XP Social'}
                </Text>
              </LinearGradient>
            )}

            {/* Recompensas da semana */}
            <View style={styles.rewardsSection}>
              <Text style={styles.sectionTitle}>Recompensas desta semana</Text>
              <View style={styles.rewardsRow}>
                {[
                  // O 1º lugar prometia "+ Badge", mas o
                  // rewardRanking só paga fragmentos — nenhum
                  // badge é concedido. Promessa retirada.
                  { pos: '🏆 1º', reward: '50 fragmentos' },
                  { pos: '🥈 2º', reward: '40 fragmentos' },
                  { pos: '🥉 3º', reward: '30 fragmentos' },
                  { pos: '4º–10º', reward: '20 fragmentos' },
                ].map((item, i) => (
                  <View key={i} style={styles.rewardChip}>
                    <Text style={styles.rewardChipPos}>{item.pos}</Text>
                    <Text style={styles.rewardChipVal}>{item.reward}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Lista */}
            <Text style={styles.sectionTitle}>Top 50 — Semana {data?.weekId}</Text>
            {top50.map(entry => (
              <RankingRow
                key={entry.uid}
                entry={entry}
                isCurrentUser={entry.uid === user?.uid}
                onPress={() => navigation.navigate('RealProfile', { userId: entry.uid })}
              />
            ))}

            {top50.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🏆</Text>
                <Text style={styles.emptyTitle}>Nenhum dado ainda</Text>
                <Text style={styles.emptySub}>Seja o primeiro a entrar no ranking!</Text>
              </View>
            )}
          </>
        )}

        {activeTab === 'progresso' && (
          <>
            {/* A aba era só um texto explicando o que ela
                DEVERIA ser, e prometia um "ranking de
                progressão" que não existe em lugar nenhum do
                backend. Agora mostra o que a pessoa realmente
                tem. */}

            {/* Nível e XP */}
            <LinearGradient colors={['#1A0A2E', '#2D1B4E']} style={styles.userCard}>
              <Text style={styles.userCardLabel}>Seu nível</Text>
              <Text style={styles.userPosition}>{xp?.level ?? 1}</Text>
              <Text style={styles.userXP}>{xp?.tier ?? ''}</Text>

              <View style={styles.barWrap}>
                <View style={styles.barTrack}>
                  <View style={[
                    styles.barFill,
                    { width: `${(xp?.levelProgress ?? 0) * 100}%` as any },
                  ]} />
                </View>
                <Text style={styles.barCaption}>
                  {xp?.totalXP ?? 0} XP · faltam {Math.max(0, (xp?.nextLevelXP ?? 0) - (xp?.totalXP ?? 0))} para o nível {(xp?.level ?? 1) + 1}
                </Text>
              </View>
            </LinearGradient>

            {/* Árvore e prestígio, lado a lado */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statIcon}>{xp?.treeIcon ?? '🌱'}</Text>
                <Text style={styles.statValue}>{xp?.treeName ?? 'Broto'}</Text>
                <Text style={styles.statLabel}>Árvore · {xp?.treeXP ?? 0} XP</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statIcon}>{prestige?.prestigeIcon ?? '✨'}</Text>
                <Text style={styles.statValue}>{prestige?.prestigeName ?? 'Desperto'}</Text>
                <Text style={styles.statLabel}>{prestige?.prestigePoints ?? 0} pts de Prestígio</Text>
              </View>
            </View>

            {/* Marcos de prestígio recentes */}
            {prestige?.legado && prestige.legado.length > 0 && (
              <>
                <Text style={styles.sectionTitleSpaced}>Marcos conquistados</Text>
                {[...prestige.legado].reverse().slice(0, 5).map((m, i) => (
                  <View key={i} style={styles.histRow}>
                    <Text style={styles.histIcon}>✦</Text>
                    <Text style={styles.histLabel}>{m.label}</Text>
                    <Text style={styles.histValue}>+{m.points} pts</Text>
                  </View>
                ))}
              </>
            )}

            {/* Histórico de XP — o xpLog nunca foi lido por
                ninguém, e todo o histórico estava lá. */}
            <Text style={styles.sectionTitleSpaced}>Seus últimos ganhos</Text>

            {history.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📈</Text>
                <Text style={styles.emptyTitle}>Nada por aqui ainda</Text>
                <Text style={styles.emptySub}>
                  Visite perfis, curta e converse — cada ação rende
                  XP e aparece aqui.
                </Text>
              </View>
            ) : (
              history.map(e => (
                <View key={e.id} style={styles.histRow}>
                  <Text style={styles.histIcon}>⬆️</Text>
                  <View style={styles.histInfo}>
                    <Text style={styles.histLabel}>{labelForAction(e.origem)}</Text>
                    {e.timestamp && (
                      <Text style={styles.histDate}>
                        {e.timestamp.toLocaleDateString('pt-BR')} às{' '}
                        {e.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
                  </View>
                  <View style={styles.histValues}>
                    <Text style={styles.histValue}>+{e.xpRecebido} XP</Text>
                    {e.treeXPRecebido > 0 && (
                      <Text style={styles.histTree}>+{e.treeXPRecebido} 🌱</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Tabs
  tabs:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab:        { flex: 1, paddingVertical: S.md, alignItems: 'center' },
  tabActive:  { borderBottomWidth: 2, borderBottomColor: COLORS.secondary },
  tabText:    { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  tabTextActive: { color: COLORS.secondary, fontWeight: FONT_WEIGHT.bold },

  // Sua posição
  userCard:      { margin: S.md, borderRadius: R.xl, padding: S.lg, alignItems: 'center', gap: S.xs, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)' },
  userCardLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 1 },
  userPosition:  { color: COLORS.secondary, fontSize: 48, fontWeight: FONT_WEIGHT.extrabold },
  userXP:        { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  userHint:      { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },

  // Recompensas
  rewardsSection: { marginHorizontal: S.md, marginBottom: S.md },
  sectionTitle:   { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: S.sm },
  rewardsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  rewardChip:     { backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.sm, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: COLORS.border, minWidth: '22%' },
  rewardChipPos:  { color: COLORS.surface, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  rewardChipVal:  { color: COLORS.secondary, fontSize: FONT_SIZE.xs },

  // Linhas
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.sm, gap: S.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowCurrent:   { backgroundColor: 'rgba(181,123,238,0.1)' },
  rowTop3:      { backgroundColor: 'rgba(255,215,0,0.04)' },
  positionBox:  { width: 36, alignItems: 'center' },
  positionIcon: { fontSize: 22 },
  positionNumber: { color: COLORS.textMuted, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  avatar:       { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  info:         { flex: 1, gap: 2 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  name:         { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium, flex: 1 },
  leagueBadge:  { borderRadius: R.full, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  leagueText:   { fontSize: 9, fontWeight: FONT_WEIGHT.bold },
  xp:           { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  reward:       { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },

  // Empty
  empty:      { alignItems: 'center', padding: S.xl * 2, gap: S.md },
  emptyIcon:  { fontSize: 60 },
  emptyTitle: { color: COLORS.surface, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
  emptySub:   { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center' },

  // Progressão
  barWrap:     { width: '100%', gap: 6, marginTop: S.sm },
  barTrack:    { height: 8, backgroundColor: COLORS.border, borderRadius: R.full, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: R.full, backgroundColor: COLORS.secondary },
  barCaption:  { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },
  statsRow:    { flexDirection: 'row', gap: S.sm, marginHorizontal: S.md, marginBottom: S.md },
  statBox:     { flex: 1, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.md, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.border },
  statIcon:    { fontSize: 30 },
  statValue:   { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  statLabel:   { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },
  sectionTitleSpaced: { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginTop: S.lg, marginBottom: S.sm },
  histRow:     { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginHorizontal: S.md, paddingVertical: S.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  histIcon:    { fontSize: 16, width: 24, textAlign: 'center' },
  histInfo:    { flex: 1, gap: 2 },
  histLabel:   { color: COLORS.surface, fontSize: FONT_SIZE.sm, flex: 1 },
  histDate:    { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  histValues:  { alignItems: 'flex-end' },
  histValue:   { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  histTree:    { color: '#A8E063', fontSize: FONT_SIZE.xs },
});
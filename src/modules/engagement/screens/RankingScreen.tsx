// ============================================
// LUMINA — RANKING SCREEN v5.2
// src/modules/engagement/screens/RankingScreen.tsx
//
// Dois rankings: Social (competitivo) + Progressão (informativo)
// Top 50 com posição do usuário destacada
// ============================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient }   from 'expo-linear-gradient';
import { useNavigation }    from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }          from '../../../context/AuthContext';
import { useRanking, RankingEntry } from '../hooks/useRanking';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { Card, EmptyState, ImageWithFallback, ErrorState } from '../../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, RANK_COLORS, GRADIENTS } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

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
  const leagueColor  = RANK_COLORS[entry.league as keyof typeof RANK_COLORS] ?? COLORS.textMuted;
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
      accessibilityRole="button"
      accessibilityLabel={`${entry.position}º lugar: ${entry.displayName}, ${entry.socialXP} XP Social`}
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
        <ImageWithFallback source={{ uri: entry.photoURL }} fallbackIcon="👤" style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={{ fontSize: FONT_SIZE.xl }}>👤</Text>
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

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Ranking Semanal" showBack={true} showHome={true} />
        <ErrorState
          onRetry={refresh}
          title="Falha ao carregar"
          message={typeof error === 'string' ? error : 'Não foi possível carregar o ranking.'}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Ranking Semanal" showBack={true} showHome={true} />

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'social' && styles.tabActive]}
          onPress={() => setActiveTab('social')}
          accessibilityRole="button"
          accessibilityLabel="Aba Ranking Social"
        >
          <Text style={[styles.tabText, activeTab === 'social' && styles.tabTextActive]}>
            🏆 Social
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'progresso' && styles.tabActive]}
          onPress={() => setActiveTab('progresso')}
          accessibilityRole="button"
          accessibilityLabel="Aba Ranking de Progressão"
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
              <LinearGradient colors={GRADIENTS.faisca as [string, string]} style={styles.userCard}>
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
              <LinearGradient colors={GRADIENTS.faisca as [string, string]} style={styles.userCard}>
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
                  { pos: '🏆 1º', reward: '50🔮 + Badge' },
                  { pos: '🥈 2º', reward: '40🔮' },
                  { pos: '🥉 3º', reward: '30🔮' },
                  { pos: '4º–10º', reward: '20🔮' },
                ].map((item, i) => (
                  <Card key={i} padding={S.sm} style={{ alignItems: 'center', gap: 2, minWidth: '22%' }}>
                    <Text style={styles.rewardChipPos}>{item.pos}</Text>
                    <Text style={styles.rewardChipVal}>{item.reward}</Text>
                  </Card>
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
              <EmptyState
                icon="🏆"
                title="Nenhum dado ainda"
                subtitle="Seja o primeiro a entrar no ranking!"
              />
            )}
          </>
        )}

        {activeTab === 'progresso' && (
          <View style={styles.progressoInfo}>
            <Text style={styles.progressoIcon}>📈</Text>
            <Text style={styles.progressoTitle}>Ranking de Progressão</Text>
            <Text style={styles.progressoDesc}>
              Este ranking é informativo e conta todo o XP acumulado — sem recompensas.
              Serve para mostrar sua evolução geral no Lumina.
            </Text>
            <Text style={styles.progressoDesc}>
              O Ranking Social (aba 🏆) é o competitivo e conta apenas XP de atividade social real.
            </Text>
          </View>
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
  userCard:      { margin: S.md, borderRadius: R.xl, padding: S.lg, alignItems: 'center', gap: S.xs, borderWidth: 1, borderColor: COLORS.borderLight },
  userCardLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 1 },
  userPosition:  { color: COLORS.secondary, fontSize: 48, fontWeight: FONT_WEIGHT.extrabold },
  userXP:        { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  userHint:      { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },

  // Recompensas
  rewardsSection: { marginHorizontal: S.md, marginBottom: S.md },
  sectionTitle:   { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: S.sm },
  rewardsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  rewardChipPos:  { color: COLORS.surface, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  rewardChipVal:  { color: COLORS.secondary, fontSize: FONT_SIZE.xs },

  // Linhas
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.sm, gap: S.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowCurrent:   { backgroundColor: COLORS.secondary + '1A' },
  rowTop3:      { backgroundColor: COLORS.premium + '0A' },
  positionBox:  { width: 36, alignItems: 'center' },
  positionIcon: { fontSize: FONT_SIZE.xxl },
  positionNumber: { color: COLORS.textMuted, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  avatar:       { width: 40, height: 40, borderRadius: BORDER_RADIUS.mlg },
  avatarPlaceholder: { backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  info:         { flex: 1, gap: 2 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  name:         { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium, flex: 1 },
  leagueBadge:  { borderRadius: R.full, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  leagueText:   { fontSize: FONT_SIZE.overline, fontWeight: FONT_WEIGHT.bold },
  xp:           { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  reward:       { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },

  // Progressão
  progressoInfo:  { alignItems: 'center', padding: S.xl, gap: S.lg },
  progressoIcon:  { fontSize: 60 },
  progressoTitle: { color: COLORS.surface, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
  progressoDesc:  { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 22 },
});
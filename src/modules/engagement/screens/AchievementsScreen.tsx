// ============================================
// LUMINA — ACHIEVEMENTS SCREEN v5.1
// src/modules/engagement/screens/AchievementsScreen.tsx
// ============================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { useNavigation }   from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }           from '../../../context/AuthContext';
import { useAchievements, Achievement, Collection, AchievementRarity } from '../hooks/useAchievements';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const RARITY_COLORS: Record<AchievementRarity, string> = {
  COMMON:    '#AAAAAA',
  RARE:      '#56CCF2',
  EPIC:      '#B57BEE',
  LEGENDARY: '#FFD700',
  MYTHIC:    '#FF6B9D',
};

const RARITY_LABELS: Record<AchievementRarity, string> = {
  COMMON:    'Comum',
  RARE:      'Rara',
  EPIC:      'Épica',
  LEGENDARY: 'Lendária',
  MYTHIC:    'Mítica',
};

const TIER_COLORS = {
  BRONZE: '#CD7F32',
  SILVER: '#C0C0C0',
  GOLD:   '#FFD700',
};

type Tab = 'conquistas' | 'colecoes';

function AchievementCard({ ach }: { ach: Achievement }) {
  const color   = RARITY_COLORS[ach.rarity];
  const pct     = ach.target > 1 ? Math.min(ach.progress / ach.target, 1) : (ach.unlocked ? 1 : 0);
  const isHidden = ach.hidden && !ach.unlocked;

  return (
    <View style={[
      styles.achCard,
      ach.unlocked && styles.achCardUnlocked,
      { borderColor: ach.unlocked ? color + '66' : COLORS.border },
    ]}>
      <View style={[styles.achIcon, { backgroundColor: color + '22' }]}>
        <Text style={styles.achIconText}>{isHidden ? '❓' : ach.icon}</Text>
      </View>
      <View style={styles.achInfo}>
        <View style={styles.achHeader}>
          <Text style={[styles.achTitle, !ach.unlocked && styles.achTitleLocked]}>
            {ach.title}
          </Text>
          <Text style={[styles.achRarity, { color }]}>
            {RARITY_LABELS[ach.rarity]}
          </Text>
        </View>
        <Text style={styles.achDesc}>{ach.description}</Text>
        {!ach.unlocked && ach.target > 1 && (
          <View style={styles.achProgress}>
            <View style={styles.achProgressBar}>
              <View style={[styles.achProgressFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
            </View>
            <Text style={styles.achProgressText}>{ach.progress}/{ach.target}</Text>
          </View>
        )}
        {ach.unlocked && (
          <Text style={[styles.achUnlocked, { color }]}>✓ Desbloqueada</Text>
        )}
      </View>
    </View>
  );
}

function CollectionCard({ col }: { col: Collection }) {
  const tierColor = TIER_COLORS[col.tier];
  const pct       = col.achTotal > 0 ? col.achProgress / col.achTotal : 0;

  return (
    <View style={[styles.colCard, col.completed && styles.colCardDone, { borderColor: col.completed ? tierColor : COLORS.border }]}>
      <LinearGradient
        colors={col.completed ? [tierColor + '22', tierColor + '11'] : [COLORS.card, COLORS.card]}
        style={styles.colInner}
      >
        <View style={styles.colHeader}>
          <Text style={styles.colIcon}>{col.icon}</Text>
          <View style={styles.colTierBadge}>
            <Text style={[styles.colTierText, { color: tierColor }]}>{col.tier}</Text>
          </View>
        </View>
        <Text style={[styles.colTitle, col.completed && { color: tierColor }]}>{col.title}</Text>
        <Text style={styles.colDesc}>{col.description}</Text>
        <View style={styles.colProgressBar}>
          <View style={[styles.colProgressFill, { width: `${pct * 100}%` as any, backgroundColor: tierColor }]} />
        </View>
        <Text style={styles.colProgress}>{col.achProgress}/{col.achTotal} conquistas</Text>
        <View style={styles.colReward}>
          {col.reward.fragments > 0 && (
            <Text style={styles.colRewardText}>🔮 +{col.reward.fragments} Fragmentos</Text>
          )}
          {col.reward.badge && (
            <Text style={styles.colRewardText}>🏅 Badge exclusivo</Text>
          )}
          {col.reward.title && (
            <Text style={styles.colRewardText}>👑 Título: {col.reward.title}</Text>
          )}
        </View>
        {col.completed && <Text style={[styles.colDone, { color: tierColor }]}>✓ Completa!</Text>}
      </LinearGradient>
    </View>
  );
}

export default function AchievementsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { data, loading, error } = useAchievements(user?.uid);
  const [activeTab, setActiveTab] = useState<Tab>('conquistas');
  const [filter,    setFilter]    = useState<string>('ALL');

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Conquistas" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  const achievements = data?.achievements ?? [];
  const collections  = data?.collections  ?? [];

  const filtered = filter === 'ALL'
    ? achievements
    : achievements.filter(a => a.category === filter);

  const categories = ['ALL', ...Array.from(new Set(achievements.map(a => a.category)))];

  return (
    <View style={styles.container}>
      <Header title="Conquistas & Coleções" showBack={true} showHome={true} />

      {/* Resumo */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {data?.totalUnlocked ?? 0}/{data?.totalAvailable ?? 0} conquistas
        </Text>
        <Text style={styles.summaryText}>
          {collections.filter(c => c.completed).length}/{collections.length} coleções
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['conquistas', 'colecoes'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'conquistas' ? '🏆 Conquistas' : '📚 Coleções'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {activeTab === 'conquistas' && (
          <>
            {/* Filtro por categoria */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.filterChip, filter === cat && styles.filterChipActive]}
                  onPress={() => setFilter(cat)}
                >
                  <Text style={[styles.filterText, filter === cat && styles.filterTextActive]}>
                    {cat === 'ALL' ? 'Todas' : cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Lista */}
            <View style={styles.list}>
              {filtered.map(ach => (
                <AchievementCard key={ach.id} ach={ach} />
              ))}
            </View>
          </>
        )}

        {activeTab === 'colecoes' && (
          <View style={styles.list}>
            {collections.map(col => (
              <CollectionCard key={col.id} col={col} />
            ))}
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
  summary:    { flexDirection: 'row', justifyContent: 'space-around', padding: S.md, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  summaryText: { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  tabs:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab:        { flex: 1, paddingVertical: S.md, alignItems: 'center' },
  tabActive:  { borderBottomWidth: 2, borderBottomColor: COLORS.secondary },
  tabText:    { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  tabTextActive: { color: COLORS.secondary, fontWeight: FONT_WEIGHT.bold },
  filterScroll: { paddingHorizontal: S.md, paddingVertical: S.sm },
  filterChip:  { backgroundColor: COLORS.card, borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.xs, marginRight: S.sm, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { borderColor: COLORS.secondary, backgroundColor: COLORS.secondary + '22' },
  filterText:  { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  filterTextActive: { color: COLORS.secondary, fontWeight: FONT_WEIGHT.bold },
  list:       { padding: S.md, gap: S.sm },

  // Achievement Card
  achCard:    { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.md, gap: S.md, borderWidth: 1, opacity: 0.7 },
  achCardUnlocked: { opacity: 1 },
  achIcon:    { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  achIconText: { fontSize: 24 },
  achInfo:    { flex: 1, gap: 4 },
  achHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achTitle:   { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  achTitleLocked: { color: COLORS.textMuted },
  achRarity:  { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
  achDesc:    { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, lineHeight: 16 },
  achProgress: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  achProgressBar: { flex: 1, height: 4, backgroundColor: COLORS.border, borderRadius: R.full, overflow: 'hidden' },
  achProgressFill: { height: '100%', borderRadius: R.full },
  achProgressText: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, width: 40, textAlign: 'right' },
  achUnlocked: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },

  // Collection Card
  colCard:    { borderRadius: R.xl, overflow: 'hidden', borderWidth: 1 },
  colCardDone: {},
  colInner:   { padding: S.lg, gap: S.sm },
  colHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  colIcon:    { fontSize: 32 },
  colTierBadge: { borderRadius: R.full, borderWidth: 1, paddingHorizontal: S.sm, paddingVertical: 2 },
  colTierText:  { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extrabold },
  colTitle:   { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extrabold },
  colDesc:    { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  colProgressBar: { height: 6, backgroundColor: COLORS.border, borderRadius: R.full, overflow: 'hidden' },
  colProgressFill: { height: '100%', borderRadius: R.full },
  colProgress: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  colReward:  { gap: 4 },
  colRewardText: { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  colDone:    { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extrabold, textAlign: 'center', marginTop: S.xs },
});
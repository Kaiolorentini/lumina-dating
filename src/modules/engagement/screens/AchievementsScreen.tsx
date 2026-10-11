// ============================================
// LUMINA — ACHIEVEMENTS SCREEN v5.3
// src/modules/engagement/screens/AchievementsScreen.tsx
//
// v5.2 (10/10/2026) — coleções coletáveis:
//  • botão "Coletar +N fragmentos" na coleção completa;
//  • modal de comemoração depois da coleta (CollectionClaimModal),
//    com atalho para o Cofre — os fragmentos vão para lá;
//  • contador de coleções para coletar na aba e no resumo;
//  • estado de erro com "Tentar de novo" e puxar para atualizar.
//
// v5.3 (11/10/2026) — abre na aba pedida pela rota (initialTab):
// a notificação de coleção completa leva direto a Coleções, mesmo
// com a tela já aberta na pilha.
// ============================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }           from '../../../context/AuthContext';
import { useAchievements, Achievement, Collection, AchievementRarity } from '../hooks/useAchievements';
import { RootStackParamList, AchievementsTab } from '../../../navigation/types';
import Header from '../../../components/Header';
import CollectionClaimModal, { CollectionClaimInfo } from '../components/CollectionClaimModal';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp   = NativeStackNavigationProp<RootStackParamList>;
type RoutePropT = RouteProp<RootStackParamList, 'Achievements'>;

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

type Tab = AchievementsTab;

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

interface CollectionCardProps {
  col:        Collection;
  claiming:   boolean;
  /** Outra coleção está sendo coletada: este botão espera. */
  disabled:   boolean;
  onClaim:    (col: Collection) => void;
}

function CollectionCard({ col, claiming, disabled, onClaim }: CollectionCardProps) {
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
        {col.claimable && (
          <TouchableOpacity
            style={[styles.claimBtn, { backgroundColor: tierColor }, (claiming || disabled) && styles.claimBtnBusy]}
            onPress={() => onClaim(col)}
            disabled={claiming || disabled}
            accessibilityRole="button"
            accessibilityLabel={`Coletar ${col.reward.fragments} fragmentos da ${col.title}`}
            accessibilityState={{ disabled: claiming || disabled, busy: claiming }}
          >
            {claiming
              ? <ActivityIndicator color="#111111" />
              : <Text style={styles.claimText}>🔮 Coletar +{col.reward.fragments} fragmentos</Text>}
          </TouchableOpacity>
        )}
        {col.claimable && !claiming && (
          <Text style={styles.claimHint}>Os fragmentos vão para o seu Cofre 🗝️</Text>
        )}
        {col.completed && !col.claimable && (
          <Text style={[styles.colDone, { color: tierColor }]}>
            {col.claimed ? '✓ Completa · fragmentos coletados' : '✓ Completa!'}
          </Text>
        )}
      </LinearGradient>
    </View>
  );
}

export default function AchievementsScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const initialTab = route.params?.initialTab;
  const { user }   = useAuth();
  const { data, loading, error, refresh, claimCollection } = useAchievements(user?.uid);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'conquistas');
  const [filter,    setFilter]    = useState<string>('ALL');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<CollectionClaimInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Tela já aberta na pilha + toque em outra notificação: o
  // navigate só troca o parâmetro — a aba acompanha.
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleClaim = useCallback(async (col: Collection) => {
    // Trava de toque duplo: uma coleta por vez. O servidor também
    // recusa pagar duas vezes (transação + claimedCollections).
    if (claimingId) return;
    setClaimingId(col.id);
    try {
      const result = await claimCollection(col.id);
      if (result.alreadyClaimed) {
        Alert.alert('Já coletada', 'Os fragmentos desta coleção já estão no seu Cofre.');
        return;
      }
      setCelebration({
        icon:           col.icon,
        title:          col.title,
        tierColor:      TIER_COLORS[col.tier],
        fragments:      result.fragments,
        vaultFragments: result.vaultFragments,
      });
    } catch (claimError) {
      Alert.alert(
        'Não foi possível coletar',
        claimError instanceof Error ? claimError.message : 'Tente de novo em instantes.',
      );
    } finally {
      setClaimingId(null);
    }
  }, [claimingId, claimCollection]);

  const closeCelebration = useCallback(() => setCelebration(null), []);
  const openVault = useCallback(() => {
    setCelebration(null);
    navigation.navigate('Vault');
  }, [navigation]);

  if (loading && !data) {
    return (
      <View style={styles.container}>
        <Header title="Conquistas" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.container}>
        <Header title="Conquistas & Coleções" showBack={true} showHome={true} />
        <View style={styles.center}>
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh} accessibilityRole="button">
            <Text style={styles.retryText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const achievements = data?.achievements ?? [];
  const collections  = data?.collections  ?? [];
  const claimableCount = collections.filter(c => c.claimable).length;

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

      {claimableCount > 0 && activeTab !== 'colecoes' && (
        <TouchableOpacity
          style={styles.claimBanner}
          onPress={() => setActiveTab('colecoes')}
          accessibilityRole="button"
        >
          <Text style={styles.claimBannerText}>
            🔮 {claimableCount === 1
              ? 'Você tem 1 coleção para coletar'
              : `Você tem ${claimableCount} coleções para coletar`} — toque aqui
          </Text>
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['conquistas', 'colecoes'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'conquistas'
                ? '🏆 Conquistas'
                : `📚 Coleções${claimableCount > 0 ? ` (${claimableCount})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.secondary}
            colors={[COLORS.secondary]}
          />
        }
      >
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
            {collections.length === 0 && (
              <Text style={styles.emptyText}>Nenhuma coleção disponível por enquanto.</Text>
            )}
            {collections.map(col => (
              <CollectionCard
                key={col.id}
                col={col}
                claiming={claimingId === col.id}
                disabled={claimingId !== null && claimingId !== col.id}
                onClaim={handleClaim}
              />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <CollectionClaimModal
        info={celebration}
        onClose={closeCelebration}
        onOpenVault={openVault}
      />
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

  // Coleta
  claimBtn:     { borderRadius: R.full, paddingVertical: S.md, alignItems: 'center', justifyContent: 'center', marginTop: S.sm, minHeight: 48 },
  claimBtnBusy: { opacity: 0.6 },
  claimText:    { color: '#111111', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extrabold },
  claimHint:    { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },
  claimBanner:  { backgroundColor: COLORS.secondary + '22', borderBottomWidth: 1, borderBottomColor: COLORS.secondary + '55', paddingVertical: S.sm, paddingHorizontal: S.md },
  claimBannerText: { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },

  // Estados
  stateIcon:  { fontSize: 40, marginBottom: S.sm },
  stateText:  { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', paddingHorizontal: S.lg },
  retryBtn:   { marginTop: S.md, borderRadius: R.full, borderWidth: 1, borderColor: COLORS.secondary, paddingHorizontal: S.lg, paddingVertical: S.sm },
  retryText:  { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  emptyText:  { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', paddingVertical: S.lg },
});

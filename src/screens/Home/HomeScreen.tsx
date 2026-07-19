// ============================================
// LUMINA — HOME SCREEN v5.4
// src/screens/Home/HomeScreen.tsx
//
// v5.4: Banner Carta do Destino adicionado
// Ordem: Header → Faísca → Carta do Destino → VisitsBanner → Tabs
// stickyHeaderIndices={[3]} — tabs fixas
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';
import { useAuth }        from '../../context/AuthContext';
import { useCoins }       from '../../context/CoinsContext';
import { useVisits }      from '../../hooks/useVisits';
import { useNotifications } from '../../hooks/useNotifications';
import ProfileCard          from '../../components/ProfileCard';
import { ProfileCardData }  from '../../components/ProfileCard';
import VisitedProfileCard   from '../../components/VisitedProfileCard';
import VisitsBanner         from '../../components/VisitsBanner';
import DestinyCardBanner    from '../../components/DestinyCardBanner';
import { getProfile }       from '../../services/profileService';
import { getCompatibleProfiles }      from '../../services/usersService';
import { getMostVisitedProfileCards } from '../../services/mostVisitedService';
import { getMostVisitedProfiles, registrarVisita } from '../../services/visitsService';
import { NativeStackNavigationProp }  from '@react-navigation/native-stack';
import { RootStackParamList }         from '../../navigation/types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

type Tab = 'perfis' | 'emalta' | 'conversas';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'perfis',     label: 'Perfis',    icon: '👤' },
  { key: 'emalta',    label: 'Em Alta',   icon: '🔥' },
  { key: 'conversas', label: 'Conversas', icon: '💬' },
];

type Props = { navigation: NativeStackNavigationProp<RootStackParamList> };

export default function HomeScreen({ navigation }: Props) {
  const { user }   = useAuth();
  const { wallet } = useCoins();

  const [activeTab,       setActiveTab]       = useState<Tab>('perfis');
  const [realProfiles,    setRealProfiles]    = useState<ProfileCardData[]>([]);
  const [mostVisited,     setMostVisited]     = useState<ProfileCardData[]>([]);
  const [visitCounts,     setVisitCounts]     = useState<Record<string, number>>({});
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingVisited,  setLoadingVisited]  = useState(false);

  const { visitasHoje, refresh: refreshVisits } = useVisits(user?.uid);
  const { unreadCount } = useNotifications(user?.uid);

  const totalCoins = (wallet?.coinsGratuitos ?? 0) + (wallet?.coinsPremium ?? 0);

  useEffect(() => { loadData(); }, [user]);

  async function loadData() {
    if (!user) return;
    try {
      const profile = await getProfile(user.uid);
      if (profile) {
        const compatible = await getCompatibleProfiles(profile);
        setRealProfiles(compatible.map(p => ({
          id:       p.uid,
          name:     p.name,
          age:      p.age,
          location: `${p.city || ''}, ${p.state || ''}`,
          sintonia: p.sintonia,
          photoURL: p.photoURL || 'https://randomuser.me/api/portraits/lego/1.jpg',
        })));
      }
      await registrarVisita(user.uid, user.uid);
      await refreshVisits();
    } catch (error) {
      console.error('[HomeScreen] Erro:', error);
    } finally {
      setLoadingProfiles(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'emalta' && mostVisited.length === 0) loadMostVisited();
  }, [activeTab]);

  async function loadMostVisited() {
    const profile = await getProfile(user?.uid || '').catch(() => null);
    if (!profile) return;
    setLoadingVisited(true);
    try {
      const cards  = await getMostVisitedProfileCards(profile, 20);
      setMostVisited(cards);
      const counts = await getMostVisitedProfiles(20);
      const countsMap: Record<string, number> = {};
      counts.forEach(c => { countsMap[c.profileId] = c.totalVisits; });
      setVisitCounts(countsMap);
    } catch (error) {
      console.error('[HomeScreen] loadMostVisited error:', error);
    } finally {
      setLoadingVisited(false);
    }
  }

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>✦ Lumina</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.coinsButton} onPress={() => navigation.navigate('MainTabs', { screen: 'Store' } as any)}>
            <Text style={styles.coinsIcon}>✨</Text>
            <Text style={styles.coinsText}>{totalCoins}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bellButton} onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <Badge label={unreadCount > 9 ? '9+' : `${unreadCount}`} variant="premium" size="sm" style={styles.badge} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/*
        stickyHeaderIndices={[3]}:
        0 = faiscaBanner
        1 = destinyCardBanner
        2 = visitsBanner
        3 = tabsWrapper ← sticky
      */}
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[3]}>

        {/* 0 — Faísca */}
        <TouchableOpacity style={styles.faiscaBanner} onPress={() => navigation.navigate('Faisca' as any)} activeOpacity={0.85}>
          <Text style={styles.faiscaIcon}>⚡</Text>
          <View style={styles.faiscaInfo}>
            <Text style={styles.faiscaTitle}>Faísca do Destino</Text>
            <Text style={styles.faiscaSub}>Toque para revelar sua surpresa de hoje</Text>
          </View>
          <Text style={styles.faiscaArrow}>›</Text>
        </TouchableOpacity>

        {/* 1 — Carta do Destino */}
        <DestinyCardBanner onPress={() => navigation.navigate('DestinyCard' as any)} />

        {/* 2 — Visitas */}
        <View style={styles.notifications}>
          <VisitsBanner visitasHoje={visitasHoje} onPress={() => navigation.navigate('Notifications')} />
        </View>

        {/* 3 — Tabs (sticky) */}
        <View style={styles.tabsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Perfis */}
        {activeTab === 'perfis' && (
          loadingProfiles ? (
            <View style={styles.loadingContainer}><ActivityIndicator color={COLORS.gold} size="large" /></View>
          ) : realProfiles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyTitle}>Nenhum perfil encontrado</Text>
              <Text style={styles.emptySubtitle}>Seja o primeiro a se cadastrar na sua região!</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {realProfiles.map(profile => (
                <ProfileCard key={profile.id} data={profile} onPress={() => navigation.navigate('RealProfile', { userId: profile.id })} />
              ))}
            </View>
          )
        )}

        {/* Em Alta */}
        {activeTab === 'emalta' && (
          loadingVisited ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={COLORS.gold} size="large" />
              <Text style={styles.loadingText}>🔥 Carregando perfis em alta...</Text>
            </View>
          ) : mostVisited.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔥</Text>
              <Text style={styles.emptyTitle}>Nenhum perfil em alta ainda</Text>
              <Text style={styles.emptySubtitle}>Visite perfis para que apareçam aqui!</Text>
            </View>
          ) : (
            <View>
              <View style={styles.mostVisitedBanner}>
                <Text style={styles.mostVisitedBannerText}>🔥 Perfis mais visitados agora</Text>
              </View>
              <View style={styles.grid}>
                {mostVisited.map((profile, index) => (
                  <VisitedProfileCard key={profile.id} data={profile} visitCount={visitCounts[profile.id] || 0} rank={index + 1} onPress={() => navigation.navigate('RealProfile', { userId: profile.id })} />
                ))}
              </View>
            </View>
          )
        )}

        {/* Conversas */}
        {activeTab === 'conversas' && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Suas conversas</Text>
            <Text style={styles.emptySubtitle}>Conecte-se com perfis e inicie conversas reais!</Text>
            <Button label="✨ Ver Sintonias" onPress={() => navigation.navigate('Sintonias' as any)} variant="primary" size="md" />
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  logo:         { fontSize: FONT_SIZE.title, color: COLORS.gold, fontWeight: FONT_WEIGHT.bold, letterSpacing: 2 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  coinsButton:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderWidth: 1, borderColor: COLORS.gold + '44', gap: 4 },
  coinsIcon:    { fontSize: FONT_SIZE.body },
  coinsText:    { color: COLORS.gold, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  bellButton:   { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, position: 'relative' },
  bellIcon:     { fontSize: FONT_SIZE.title },
  badge:        { position: 'absolute', top: -4, right: -4, borderRadius: BORDER_RADIUS.full, borderWidth: 2, borderColor: COLORS.background },
  faiscaBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.lg, marginTop: SPACING.sm, marginBottom: SPACING.xs, backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.accent + '66', gap: SPACING.sm },
  faiscaIcon:   { fontSize: FONT_SIZE.hero },
  faiscaInfo:   { flex: 1 },
  faiscaTitle:  { color: COLORS.accent, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  faiscaSub:    { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, marginTop: 2 },
  faiscaArrow:  { color: COLORS.accent, fontSize: 24, fontWeight: FONT_WEIGHT.bold },
  notifications: { paddingTop: SPACING.xs },
  tabsWrapper:  { backgroundColor: COLORS.background, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabs:         { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  tab:          { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  tabActive:    { borderColor: COLORS.gold, backgroundColor: COLORS.gold + '22' },
  tabIcon:      { fontSize: FONT_SIZE.body },
  tabLabel:     { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  tabLabelActive: { color: COLORS.gold },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.sm },
  mostVisitedBanner:     { marginHorizontal: SPACING.lg, marginTop: SPACING.md, marginBottom: SPACING.sm, backgroundColor: COLORS.gold + '22', borderRadius: BORDER_RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.gold + '44' },
  mostVisitedBannerText: { color: COLORS.gold, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, textAlign: 'center', letterSpacing: 1 },
  loadingContainer: { paddingTop: 80, alignItems: 'center', gap: SPACING.md },
  loadingText:  { color: COLORS.gold, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: SPACING.xl, gap: SPACING.md },
  emptyIcon:    { fontSize: 60 },
  emptyTitle:   { color: COLORS.textPrimary, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  emptySubtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, textAlign: 'center', lineHeight: 22 },

});
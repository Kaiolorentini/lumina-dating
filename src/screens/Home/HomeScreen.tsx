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
import { colors, fonts, spacing, borderRadius } from '../../theme';
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
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
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
            <View style={styles.loadingContainer}><ActivityIndicator color={colors.gold} size="large" /></View>
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
              <ActivityIndicator color={colors.gold} size="large" />
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
            <TouchableOpacity style={styles.discoverButton} onPress={() => navigation.navigate('Sintonias' as any)}>
              <Text style={styles.discoverButtonText}>✨ Ver Sintonias</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  logo:         { fontSize: fonts.sizes.xl, color: colors.gold, fontWeight: 'bold', letterSpacing: 2 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  coinsButton:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.gold + '44', gap: 4 },
  coinsIcon:    { fontSize: 14 },
  coinsText:    { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  bellButton:   { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.grayDark, position: 'relative' },
  bellIcon:     { fontSize: 20 },
  badge:        { position: 'absolute', top: -4, right: -4, backgroundColor: colors.gold, borderRadius: borderRadius.full, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.background },
  badgeText:    { color: colors.background, fontSize: 10, fontWeight: 'bold' },
  faiscaBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.xs, backgroundColor: '#2D1B4E', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: '#7B2FBE', gap: spacing.sm },
  faiscaIcon:   { fontSize: 28 },
  faiscaInfo:   { flex: 1 },
  faiscaTitle:  { color: '#B57BEE', fontSize: fonts.sizes.md, fontWeight: 'bold' },
  faiscaSub:    { color: '#888', fontSize: fonts.sizes.xs, marginTop: 2 },
  faiscaArrow:  { color: '#7B2FBE', fontSize: 24, fontWeight: 'bold' },
  notifications: { paddingTop: spacing.xs },
  tabsWrapper:  { backgroundColor: colors.background, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.grayDark },
  tabs:         { paddingHorizontal: spacing.lg, gap: spacing.sm },
  tab:          { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.grayDark, backgroundColor: colors.surface },
  tabActive:    { borderColor: colors.gold, backgroundColor: colors.gold + '22' },
  tabIcon:      { fontSize: 14 },
  tabLabel:     { color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  tabLabelActive: { color: colors.gold },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  mostVisitedBanner:     { marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.gold + '22', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.gold + '44' },
  mostVisitedBannerText: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold', textAlign: 'center', letterSpacing: 1 },
  loadingContainer: { paddingTop: 80, alignItems: 'center', gap: spacing.md },
  loadingText:  { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: spacing.xl, gap: spacing.md },
  emptyIcon:    { fontSize: 60 },
  emptyTitle:   { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', textAlign: 'center' },
  emptySubtitle: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center', lineHeight: 22 },
  discoverButton: { backgroundColor: colors.gold, borderRadius: borderRadius.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.sm },
  discoverButtonText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
});
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { RootStackParamList } from '../../../navigation/types';
import { ProfileCardData } from '../../../shared/types';
import { AI_MODELS } from '../../ai/data/aiModels';
import ProfileCard from '../../../components/ProfileCard';
import VisitedProfileCard from '../../../components/VisitedProfileCard';
import VisitsBanner from '../../../components/VisitsBanner';
import { useHomeData, HomeTab } from '../hooks/useHomeData';

// ============================================
// HOME SCREEN — MÓDULO HOME
// Screen limpa: apenas renderiza UI.
// Toda lógica está no useHomeData.
// ============================================

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const TABS: { key: HomeTab; label: string; icon: string }[] = [
  { key: 'ia', label: 'Modelos IA', icon: '🤖' },
  { key: 'perfis', label: 'Perfis', icon: '👤' },
  { key: 'visitados', label: 'Mais visitados', icon: '🔥' },
  { key: 'conversas', label: 'Conversas', icon: '💬' },
];

export default function HomeScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<HomeTab>('ia');

  const {
    aiModels,
    realProfiles,
    mostVisited,
    visitCounts,
    loadingVisited,
    visitasHoje,
    unreadCount,
    coins,
    loadMostVisited,
  } = useHomeData();

  // Carrega mais visitados quando aba é selecionada
  useEffect(() => {
    if (activeTab === 'visitados' && mostVisited.length === 0) {
      loadMostVisited();
    }
  }, [activeTab]);

  function getDataForTab(): ProfileCardData[] {
    switch (activeTab) {
      case 'ia': return aiModels;
      case 'perfis': return realProfiles;
      default: return [];
    }
  }

  function handleCardPress(profile: ProfileCardData) {
    if (profile.isAI) {
      const aiModel = AI_MODELS.find(m => m.id === profile.id);
      if (aiModel) {
        navigation.navigate('AIProfile', { model: aiModel });
      }
    } else {
      navigation.navigate('RealProfile', { userId: profile.id });
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>✦ Lumina</Text>
        <View style={styles.headerRight}>
          {/* Moedas */}
          <TouchableOpacity
            style={styles.coinsButton}
            onPress={() => navigation.navigate('MainTabs')}
          >
            <Text style={styles.coinsIcon}>💰</Text>
            <Text style={styles.coinsText}>{coins}</Text>
          </TouchableOpacity>

          {/* Sino */}
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* Banner de visitas */}
        <View style={styles.notifications}>
          <VisitsBanner
            visitasHoje={visitasHoje}
            onPress={() => navigation.navigate('Notifications')}
          />
        </View>

        {/* Abas */}
        <View style={styles.tabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
          >
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  activeTab === tab.key && styles.tabActive,
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text style={[
                  styles.tabLabel,
                  activeTab === tab.key && styles.tabLabelActive,
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Aba Conversas */}
        {activeTab === 'conversas' && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Visite perfis das IAs</Text>
            <Text style={styles.emptySubtitle}>
              Ao visitar um perfil a IA entrará em contato automaticamente!
            </Text>
          </View>
        )}

        {/* Aba Mais Visitados */}
        {activeTab === 'visitados' && (
          loadingVisited ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>
                🔥 Carregando perfis em alta...
              </Text>
            </View>
          ) : mostVisited.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔥</Text>
              <Text style={styles.emptyTitle}>Nenhum perfil ainda</Text>
              <Text style={styles.emptySubtitle}>
                Visite perfis para que apareçam aqui!
              </Text>
            </View>
          ) : (
            <View>
              <View style={styles.mostVisitedBanner}>
                <Text style={styles.mostVisitedBannerText}>
                  🔥 Perfis mais visitados agora
                </Text>
              </View>
              <View style={styles.grid}>
                {mostVisited.map((profile, index) => (
                  <VisitedProfileCard
                    key={profile.id}
                    data={profile}
                    visitCount={visitCounts[profile.id] || 0}
                    rank={index + 1}
                    onPress={() => handleCardPress(profile)}
                  />
                ))}
              </View>
            </View>
          )
        )}

        {/* Abas IA e Perfis */}
        {(activeTab === 'ia' || activeTab === 'perfis') && (
          getDataForTab().length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>
                {activeTab === 'ia' ? '🤖' : '👤'}
              </Text>
              <Text style={styles.emptyTitle}>
                {activeTab === 'ia'
                  ? 'Carregando IAs...'
                  : 'Nenhum perfil encontrado'}
              </Text>
              {activeTab === 'perfis' && (
                <Text style={styles.emptySubtitle}>
                  Seja o primeiro a se cadastrar na sua região!
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.grid}>
              {getDataForTab().map(profile => (
                <ProfileCard
                  key={profile.id}
                  data={profile}
                  onPress={() => handleCardPress(profile)}
                />
              ))}
            </View>
          )
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  logo: {
    fontSize: fonts.sizes.xl,
    color: colors.gold,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  coinsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    gap: 4,
  },
  coinsIcon: { fontSize: 14 },
  coinsText: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.grayDark,
    position: 'relative',
  },
  bellIcon: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.gold,
    borderRadius: borderRadius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: 'bold',
  },
  notifications: { paddingTop: spacing.sm },
  tabsWrapper: {
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayDark,
  },
  tabs: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.grayDark,
    backgroundColor: colors.surface,
  },
  tabActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold + '22',
  },
  tabIcon: { fontSize: 14 },
  tabLabel: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
  },
  tabLabelActive: { color: colors.gold },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  mostVisitedBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.gold + '22',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold + '44',
  },
  mostVisitedBannerText: {
    color: colors.gold,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
  },
  loadingContainer: {
    paddingTop: 80,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.gold,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 60 },
  emptyTitle: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
});
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import ProfileCard, { ProfileCardData } from '../../components/ProfileCard';
import VisitedProfileCard from '../../components/VisitedProfileCard';
import VisitsBanner from '../../components/VisitsBanner';
import { AI_MODELS } from '../../utils/aiModels';
import { calcularSintoniaIA } from '../../utils/sintoniaEngine';
import { getProfile } from '../../services/profileService';
import { getCompatibleProfiles } from '../../services/usersService';
import { getMostVisitedProfileCards } from '../../services/mostVisitedService';
import { getMostVisitedProfiles } from '../../services/visitsService';
import { UserProfile } from '../../types';
import { useVisits } from '../../hooks/useVisits';
import { useNotifications } from '../../hooks/useNotifications';
import { useCoins } from '../../context/CoinsContext';
import { registrarVisita } from '../../services/visitsService';
import { gerarNotificacoesAutomaticas } from '../../services/notificationsService';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';

type Tab = 'ia' | 'perfis' | 'visitados' | 'conversas';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'ia', label: 'Modelos IA', icon: '🤖' },
  { key: 'perfis', label: 'Perfis', icon: '👤' },
  { key: 'visitados', label: 'Mais visitados', icon: '🔥' },
  { key: 'conversas', label: 'Conversas', icon: '💬' },
];

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export default function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { wallet } = useCoins();
  const [activeTab, setActiveTab] = useState<Tab>('ia');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [aiModels, setAiModels] = useState<ProfileCardData[]>(AI_MODELS);
  const [realProfiles, setRealProfiles] = useState<ProfileCardData[]>([]);
  const [mostVisited, setMostVisited] = useState<ProfileCardData[]>([]);
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({});
  const [loadingVisited, setLoadingVisited] = useState(false);
  const { visitasHoje, refresh: refreshVisits } = useVisits(user?.uid);
  const { unreadCount } = useNotifications(user?.uid);

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;

    try {
      const profile = await getProfile(user.uid);
      if (profile) {
        setUserProfile(profile);

        // Atualiza Sintonia dos modelos IA
        const updatedModels = AI_MODELS.map(model => ({
          ...model,
          sintonia: calcularSintoniaIA(profile),
        }));
        setAiModels(updatedModels);

        // Carrega perfis reais compatíveis
        const compatible = await getCompatibleProfiles(profile);
        setRealProfiles(compatible.map(p => ({
          id: p.uid,
          name: p.name,
          age: p.age,
          location: `${p.city || ''}, ${p.state || ''}`,
          sintonia: p.sintonia,
          photoURL: p.photoURL || 'https://randomuser.me/api/portraits/lego/1.jpg',
          isAI: false,
        })));
      }

      // Simula visitas para demonstração
      await simulateVisits(user.uid);
      await refreshVisits();
      await gerarNotificacoesAutomaticas(user.uid);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  }

  // Carrega perfis mais visitados quando aba é selecionada
  useEffect(() => {
    if (activeTab === 'visitados' && mostVisited.length === 0) {
      loadMostVisited();
    }
  }, [activeTab]);

  async function loadMostVisited() {
    if (!userProfile) return;
    setLoadingVisited(true);
    try {
      // Busca cards dos perfis mais visitados
      const cards = await getMostVisitedProfileCards(userProfile, 20);
      setMostVisited(cards);

      // Busca contadores para exibir no card
      const counts = await getMostVisitedProfiles(20);
      const countsMap: Record<string, number> = {};
      counts.forEach(c => {
        countsMap[c.profileId] = c.totalVisits;
      });
      setVisitCounts(countsMap);
    } catch (error) {
      console.error('Erro ao carregar mais visitados:', error);
    } finally {
      setLoadingVisited(false);
    }
  }

  async function simulateVisits(userId: string) {
    const fakeVisitors = ['visitor_1', 'visitor_2', 'visitor_3'];
    for (const visitorId of fakeVisitors) {
      await registrarVisita(visitorId, userId);
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

  function getDataForTab(): ProfileCardData[] {
    switch (activeTab) {
      case 'ia': return aiModels;
      case 'perfis': return realProfiles;
      default: return [];
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
            <Text style={styles.coinsText}>{wallet?.coins || 0}</Text>
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

        {/* Conteúdo por aba */}

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
              <Text style={styles.loadingText}>🔥 Carregando perfis em alta...</Text>
            </View>
          ) : mostVisited.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔥</Text>
              <Text style={styles.emptyTitle}>Nenhum perfil visitado ainda</Text>
              <Text style={styles.emptySubtitle}>
                Visite perfis para que apareçam aqui!
              </Text>
            </View>
          ) : (
            <View>
              {/* Banner de destaque */}
              <View style={styles.mostVisitedBanner}>
                <Text style={styles.mostVisitedBannerText}>
                  🔥 Perfis mais visitados agora
                </Text>
              </View>

              {/* Grid de perfis mais visitados */}
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
                {activeTab === 'ia' ? 'Carregando IAs...' : 'Nenhum perfil encontrado'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'perfis' && 'Seja o primeiro a se cadastrar na sua região!'}
              </Text>
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
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { RootStackParamList } from '../../../navigation/types';
import { ProfileCardData } from '../../../shared/types';

import ProfileCard from '../../../components/ProfileCard';
import VisitedProfileCard from '../../../components/VisitedProfileCard';
import VisitsBanner from '../../../components/VisitsBanner';
import { useHomeData, HomeTab } from '../hooks/useHomeData';
import { useAuth } from '../../../context/AuthContext';
import { getConexoesAceitas } from '../../profile/services/requestsService';
import { generateChatId } from '../../chat/services/messageService';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { COLLECTIONS } from '../../../core/constants';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const TABS = [
  { key: 'perfis', label: 'Perfis', icon: '👤' },
  { key: 'visitados', label: 'Em Alta', icon: '🔥' },
  { key: 'conversas', label: 'Conversas', icon: '💬' },
];

interface ChatPreview {
  userId: string;
  userName: string;
  userPhoto: string;
  lastMessage: string;
}

function ConversasTab({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChats();
  }, []);

  async function loadChats() {
    if (!user) return;
    try {
      const conexoes = await getConexoesAceitas(user.uid);
      const previews: ChatPreview[] = [];

      for (const conexao of conexoes) {
        const otherUserId = conexao.fromUserId === user.uid
          ? conexao.toUserId
          : conexao.fromUserId;

        const chatId = generateChatId(user.uid, otherUserId);
        const chatSnap = await getDoc(doc(db, COLLECTIONS.CHATS, chatId));
        const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, otherUserId));
        const otherUser = userSnap.data();

        if (otherUser) {
          previews.push({
            userId: otherUserId,
            userName: otherUser.name || 'Usuario',
            userPhoto: otherUser.photoURL || '',
            lastMessage: chatSnap.exists()
              ? chatSnap.data()?.lastMessage || 'Iniciar conversa'
              : 'Iniciar conversa',
          });
        }
      }
      setChats(previews);
    } catch (e) {
      console.error('Erro ao carregar chats:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (chats.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>💬</Text>
        <Text style={styles.emptyTitle}>Nenhuma conversa ainda</Text>
        <Text style={styles.emptySubtitle}>
          Conecte-se com outros usuarios para comecar a conversar!
        </Text>
      </View>
    );
  }

  return (
    <View>
      {chats.map(chat => (
        <TouchableOpacity
          key={chat.userId}
          style={styles.chatItem}
          onPress={() => navigation.navigate('UserChat', {
            userId: chat.userId,
            userName: chat.userName,
            userPhoto: chat.userPhoto,
          })}
          activeOpacity={0.8}
        >
          {chat.userPhoto ? (
            <Image source={{ uri: chat.userPhoto }} style={styles.chatAvatar} />
          ) : (
            <View style={styles.chatAvatarPlaceholder}>
              <Text style={styles.chatAvatarLetter}>
                {chat.userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.chatInfo}>
            <Text style={styles.chatName}>{chat.userName}</Text>
            <Text style={styles.chatLastMessage} numberOfLines={1}>
              {chat.lastMessage}
            </Text>
          </View>
          <Text style={styles.chatArrow}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
 const [activeTab, setActiveTab] = useState<HomeTab>('perfis');

  const {

    realProfiles,
    mostVisited,
    visitCounts,
    loadingVisited,
    visitasHoje,
    unreadCount,
    coins,
    loadMostVisited,
  } = useHomeData();

  useEffect(() => {
    if (activeTab === 'visitados' && mostVisited.length === 0) {
      loadMostVisited();
    }
  }, [activeTab]);

  function getDataForTab(): ProfileCardData[] {
  return realProfiles;
}

  function handleCardPress(profile: ProfileCardData) {
    if (profile.isAI) {
  
     
    } else {
      navigation.navigate('RealProfile', { userId: profile.id });
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>✦ Lumina</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.coinsButton}
            onPress={() => navigation.navigate('MainTabs')}
          >
            <Text style={styles.coinsIcon}>💰</Text>
            <Text style={styles.coinsText}>{coins}</Text>
          </TouchableOpacity>
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
        <View style={styles.notifications}>
          <VisitsBanner
            visitasHoje={visitasHoje}
            onPress={() => navigation.navigate('Notifications')}
          />
        </View>

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

        {activeTab === 'conversas' && (
          <ConversasTab navigation={navigation} />
        )}

        {activeTab === 'visitados' && (
          loadingVisited ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>
                Carregando perfis em alta...
              </Text>
            </View>
          ) : mostVisited.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔥</Text>
              <Text style={styles.emptyTitle}>Nenhum perfil ainda</Text>
              <Text style={styles.emptySubtitle}>
                Visite perfis para que aparecam aqui!
              </Text>
            </View>
          ) : (
            <View>
              <View style={styles.mostVisitedBanner}>
                <Text style={styles.mostVisitedBannerText}>
                  Perfis mais visitados agora
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

        {(activeTab === 'ia' || activeTab === 'perfis') && (
          getDataForTab().length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>
                
              </Text>
              <Text style={styles.emptyTitle}>
                {activeTab === 'ia'
                  ? 'Carregando IAs...'
                  : 'Nenhum perfil encontrado'}
              </Text>
              {activeTab === 'perfis' && (
                <Text style={styles.emptySubtitle}>
                  Seja o primeiro a se cadastrar na sua regiao!
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
  container: { flex: 1, backgroundColor: colors.background },
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
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayDark,
    gap: spacing.md,
  },
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  chatAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarLetter: {
    color: colors.gold,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
  },
  chatInfo: { flex: 1 },
  chatName: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
  },
  chatLastMessage: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    marginTop: 2,
  },
  chatArrow: {
    color: colors.gray,
    fontSize: fonts.sizes.xl,
  },
});
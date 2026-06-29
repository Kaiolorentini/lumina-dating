// ============================================
// LUMINA — HOME SCREEN v5.5
// src/modules/home/screens/HomeScreen.tsx
//
// v5.5: Banner Cofre de Sintonia adicionado
// stickyHeaderIndices={[5]} corrigido
// Ordem:
//   0 = faiscaBanner
//   1 = destinyCardBanner
//   2 = missionsBanner
//   3 = vaultBanner
//   4 = visitsBanner
//   5 = tabsWrapper ← sticky
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { RootStackParamList } from '../../../navigation/types';
import { ProfileCardData }    from '../../../shared/types';
import ProfileCard            from '../../../components/ProfileCard';
import VisitedProfileCard     from '../../../components/VisitedProfileCard';
import VisitsBanner           from '../../../components/VisitsBanner';
import DestinyCardBanner      from '../../../components/DestinyCardBanner';
import MissionsBanner         from '../../../components/MissionsBanner';
import { useHomeData, HomeTab } from '../hooks/useHomeData';
import { useAuth }            from '../../../context/AuthContext';
import { getConexoesAceitas } from '../../profile/services/requestsService';
import { generateChatId }     from '../../chat/services/messageService';
import { getDoc, doc }        from 'firebase/firestore';
import { db }                 from '../../../services/firebase';
import { COLLECTIONS }        from '../../../core/constants';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const TABS: { key: HomeTab; label: string; icon: string }[] = [
  { key: 'perfis',    label: 'Perfis',    icon: '👤' },
  { key: 'visitados', label: 'Em Alta',   icon: '🔥' },
  { key: 'conversas', label: 'Conversas', icon: '💬' },
];

interface ChatPreview {
  userId:      string;
  userName:    string;
  userPhoto:   string;
  lastMessage: string;
}

function ConversasTab({ navigation }: { navigation: any }) {
  const { user }              = useAuth();
  const [chats, setChats]     = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadChats(); }, []);

  async function loadChats() {
    if (!user) return;
    try {
      const conexoes = await getConexoesAceitas(user.uid);
      const previews: ChatPreview[] = [];
      for (const conexao of conexoes) {
        const otherUserId = conexao.fromUserId === user.uid
          ? conexao.toUserId : conexao.fromUserId;
        const chatId    = generateChatId(user.uid, otherUserId);
        const chatSnap  = await getDoc(doc(db, COLLECTIONS.CHATS, chatId));
        const userSnap  = await getDoc(doc(db, COLLECTIONS.USERS, otherUserId));
        const otherUser = userSnap.data();
        if (otherUser) {
          previews.push({
            userId:      otherUserId,
            userName:    otherUser.name || 'Usuario',
            userPhoto:   otherUser.photoURL || '',
            lastMessage: chatSnap.exists()
              ? chatSnap.data()?.lastMessage || 'Iniciar conversa'
              : 'Iniciar conversa',
          });
        }
      }
      setChats(previews);
    } catch (e) {
      console.error('[ConversasTab] error:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <View style={styles.emptyContainer}>
      <ActivityIndicator color={colors.gold} size="large" />
    </View>
  );

  if (chats.length === 0) return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={styles.emptyTitle}>Nenhuma conversa ainda</Text>
      <Text style={styles.emptySubtitle}>Conecte-se com outros usuários para começar!</Text>
    </View>
  );

  return (
    <View>
      {chats.map(chat => (
        <TouchableOpacity
          key={chat.userId}
          style={styles.chatItem}
          onPress={() => navigation.navigate('UserChat', {
            userId: chat.userId, userName: chat.userName, userPhoto: chat.userPhoto,
          })}
          activeOpacity={0.8}
        >
          {chat.userPhoto
            ? <Image source={{ uri: chat.userPhoto }} style={styles.chatAvatar} />
            : <View style={styles.chatAvatarPlaceholder}>
                <Text style={styles.chatAvatarLetter}>{chat.userName.charAt(0).toUpperCase()}</Text>
              </View>
          }
          <View style={styles.chatInfo}>
            <Text style={styles.chatName}>{chat.userName}</Text>
            <Text style={styles.chatLastMessage} numberOfLines={1}>{chat.lastMessage}</Text>
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
    realProfiles, mostVisited, visitCounts,
    loadingVisited, visitasHoje, unreadCount,
    coins, loadMostVisited,
  } = useHomeData();

  useEffect(() => {
    if (activeTab === 'visitados' && mostVisited.length === 0) {
      loadMostVisited();
    }
  }, [activeTab]);

  function handleCardPress(profile: ProfileCardData) {
    navigation.navigate('RealProfile', { userId: profile.id });
  }

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>✦ Lumina</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.coinsButton}
            onPress={() => (navigation as any).jumpTo('Store')}
          >
            <Text style={styles.coinsIcon}>✨</Text>
            <Text style={styles.coinsText}>{coins}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[5]}>

        {/* 0 — Faísca do Destino */}
        <TouchableOpacity
          style={styles.faiscaBanner}
          onPress={() => navigation.navigate('Faisca' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.faiscaIcon}>⚡</Text>
          <View style={styles.faiscaInfo}>
            <Text style={styles.faiscaTitle}>Faísca do Destino</Text>
            <Text style={styles.faiscaSub}>Toque para revelar sua surpresa de hoje</Text>
          </View>
          <Text style={styles.faiscaArrow}>›</Text>
        </TouchableOpacity>

        {/* 1 — Carta do Destino */}
        <DestinyCardBanner
          onPress={() => navigation.navigate('DestinyCard' as any)}
        />

        {/* 2 — Missões */}
        <MissionsBanner
          completedCount={0}
          totalCount={3}
          onPress={() => navigation.navigate('Missions' as any)}
        />

        {/* 3 — Cofre de Sintonia */}
        <TouchableOpacity
          style={styles.vaultBanner}
          onPress={() => navigation.navigate('Vault' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.vaultIcon}>🗝️</Text>
          <View style={styles.vaultInfo}>
            <Text style={styles.vaultTitle}>Cofre de Sintonia</Text>
            <Text style={styles.vaultSub}>Recompensas por atividade social</Text>
          </View>
          <Text style={styles.vaultArrow}>›</Text>
        </TouchableOpacity>

        {/* 4 — Visitas */}
        <View style={styles.notifications}>
          <VisitsBanner
            visitasHoje={visitasHoje}
            onPress={() => navigation.navigate('Notifications')}
          />
        </View>

        {/* 5 — Tabs (sticky) */}
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

        {/* Conversas */}
        {activeTab === 'conversas' && <ConversasTab navigation={navigation} />}

        {/* Em Alta */}
        {activeTab === 'visitados' && (
          loadingVisited ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Carregando perfis em alta...</Text>
            </View>
          ) : mostVisited.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔥</Text>
              <Text style={styles.emptyTitle}>Nenhum perfil ainda</Text>
              <Text style={styles.emptySubtitle}>Visite perfis para que apareçam aqui!</Text>
            </View>
          ) : (
            <View>
              <View style={styles.mostVisitedBanner}>
                <Text style={styles.mostVisitedBannerText}>Perfis mais visitados agora</Text>
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

        {/* Perfis */}
        {activeTab === 'perfis' && (
          realProfiles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyTitle}>Nenhum perfil encontrado</Text>
              <Text style={styles.emptySubtitle}>Seja o primeiro a se cadastrar na sua região!</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {realProfiles.map(profile => (
                <ProfileCard key={profile.id} data={profile} onPress={() => handleCardPress(profile)} />
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

  // Faísca
  faiscaBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.xs, backgroundColor: '#2D1B4E', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: '#7B2FBE', gap: spacing.sm },
  faiscaIcon:   { fontSize: 28 },
  faiscaInfo:   { flex: 1 },
  faiscaTitle:  { color: '#B57BEE', fontSize: fonts.sizes.md, fontWeight: 'bold' },
  faiscaSub:    { color: '#888', fontSize: fonts.sizes.xs, marginTop: 2 },
  faiscaArrow:  { color: '#7B2FBE', fontSize: 24, fontWeight: 'bold' },

  // Cofre
  vaultBanner:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.xs, backgroundColor: '#1A0A0A', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: '#8B6914', gap: spacing.sm },
  vaultIcon:    { fontSize: 28 },
  vaultInfo:    { flex: 1 },
  vaultTitle:   { color: '#FFD700', fontSize: fonts.sizes.md, fontWeight: 'bold' },
  vaultSub:     { color: '#888', fontSize: fonts.sizes.xs, marginTop: 2 },
  vaultArrow:   { color: '#8B6914', fontSize: 24, fontWeight: 'bold' },

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
  loadingContainer: { paddingTop: 80, alignItems: 'center' },
  loadingText:  { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: spacing.xl, gap: spacing.md },
  emptyIcon:    { fontSize: 60 },
  emptyTitle:   { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', textAlign: 'center' },
  emptySubtitle: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center', lineHeight: 22 },
  chatItem:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.grayDark, gap: spacing.md },
  chatAvatar:   { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.gold },
  chatAvatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  chatAvatarLetter: { color: colors.gold, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  chatInfo:     { flex: 1 },
  chatName:     { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  chatLastMessage: { color: colors.gray, fontSize: fonts.sizes.sm, marginTop: 2 },
  chatArrow:    { color: colors.gray, fontSize: fonts.sizes.xl },
});
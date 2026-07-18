import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { COLLECTIONS } from '../../core/constants';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getConexoesAceitas } from '../../modules/profile/services/requestsService';
import { getBloqueados } from '../../modules/profile/services/blockService';
import { RootStackParamList } from '../../navigation/types';
import Header from '../../components/Header';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface Connection {
  userId: string;
  userName: string;
  userPhoto: string;
}

export default function SintoniasScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadConnections();
  }, [user]);

  async function loadConnections() {
    if (!user) return;
    try {
      const conexoes = await getConexoesAceitas(user.uid);
      const blocked = await getBloqueados(user.uid);
      const blockedIds = new Set(blocked.map(b => b.blockedId));

      const result: Connection[] = [];

      for (const conexao of conexoes) {
        const otherUserId = conexao.fromUserId === user.uid
          ? conexao.toUserId
          : conexao.fromUserId;

        if (blockedIds.has(otherUserId)) continue;

        const otherUserSnap = await getDoc(doc(db, COLLECTIONS.USERS, otherUserId));
        const otherUser = otherUserSnap.data();
        if (!otherUser) continue;

        if (otherUser.isBlocked) continue;

        result.push({
          userId: otherUserId,
          userName: otherUser.name || 'Usuario',
          userPhoto: otherUser.photoURL || '',
        });
      }

      setConnections(result);
    } catch (error) {
      console.error('Erro ao carregar conexoes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadConnections();
    setRefreshing(false);
  }

  function renderConnection({ item }: { item: Connection }) {
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.profileArea}
          onPress={() => navigation.navigate('RealProfile', { userId: item.userId })}
          activeOpacity={0.7}
        >
          {item.userPhoto ? (
            <Image source={{ uri: item.userPhoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarLetter}>
                {item.userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.userName} numberOfLines={1}>{item.userName}</Text>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('RealProfile', { userId: item.userId })}
            activeOpacity={0.7}
          >
            <Text style={styles.profileBtnText}>👤 Perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => navigation.navigate('UserChat', {
              userId: item.userId,
              userName: item.userName,
              userPhoto: item.userPhoto,
            })}
            activeOpacity={0.7}
          >
            <Text style={styles.chatBtnText}>💬 Conversar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScreenContainer>
      <Header title="Sintonias" showBack={false} showHome={false} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Carregando conexoes...</Text>
        </View>
      ) : connections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💫</Text>
          <Text style={styles.emptyTitle}>Nenhuma conexao ainda</Text>
          <Text style={styles.emptySubtitle}>
            Conecte-se com perfis para comecar a interagir!
          </Text>
          <TouchableOpacity
            style={styles.discoverButton}
            onPress={() => navigation.navigate('MainTabs')}
          >
            <Text style={styles.discoverButtonText}>✦ Descobrir perfis</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={connections}
          keyExtractor={item => item.userId}
          renderItem={renderConnection}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.md }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.gold}
            />
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { color: colors.gray, fontSize: fonts.sizes.md },
  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, gap: spacing.md,
  },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', textAlign: 'center' },
  emptySubtitle: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center', lineHeight: 22 },
  discoverButton: {
    backgroundColor: colors.gold, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.sm,
  },
  discoverButtonText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    gap: spacing.md, backgroundColor: colors.background,
    borderBottomWidth: 0.5, borderBottomColor: colors.grayDark,
  },
  profileArea: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: colors.gold,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { color: colors.gold, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  userName: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  profileBtn: {
    backgroundColor: colors.surface, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gold, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  profileBtnText: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  chatBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  chatBtnText: { color: colors.background, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
});

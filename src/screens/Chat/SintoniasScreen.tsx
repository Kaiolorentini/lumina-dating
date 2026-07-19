import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Button, Card, EmptyState } from '../../components/ui';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { COLLECTIONS } from '../../core/constants';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../theme/tokens';
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

  useEffect(() => { loadConnections(); }, [user]);

  async function loadConnections() {
    if (!user) return;
    try {
      const conexoes = await getConexoesAceitas(user.uid);
      const blocked = await getBloqueados(user.uid);
      const blockedIds = new Set(blocked.map(b => b.blockedId));
      const result: Connection[] = [];

      for (const conexao of conexoes) {
        const otherUserId = conexao.fromUserId === user.uid ? conexao.toUserId : conexao.fromUserId;
        if (blockedIds.has(otherUserId)) continue;
        const otherUserSnap = await getDoc(doc(db, COLLECTIONS.USERS, otherUserId));
        const otherUser = otherUserSnap.data();
        if (!otherUser || otherUser.isBlocked) continue;
        result.push({ userId: otherUserId, userName: otherUser.name || 'Usuario', userPhoto: otherUser.photoURL || '' });
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
      <Card padding={SPACING.md} style={styles.card}>
        <TouchableOpacity style={styles.profileArea} onPress={() => navigation.navigate('RealProfile', { userId: item.userId })} activeOpacity={0.7}>
          {item.userPhoto ? (
            <Image source={{ uri: item.userPhoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarLetter}>{item.userName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.userName} numberOfLines={1}>{item.userName}</Text>
        </TouchableOpacity>
        <View style={styles.actions}>
          <Button label="👤 Perfil" variant="ghost" onPress={() => navigation.navigate('RealProfile', { userId: item.userId })} />
          <Button label="💬 Conversar" variant="primary" onPress={() => navigation.navigate('UserChat', { userId: item.userId, userName: item.userName, userPhoto: item.userPhoto })} />
        </View>
      </Card>
    );
  }

  return (
    <ScreenContainer>
      <Header title="Sintonias" showBack={false} showHome={false} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.gold} size="large" />
          <Text style={styles.loadingText}>Carregando conexoes...</Text>
        </View>
      ) : connections.length === 0 ? (
        <EmptyState
          icon="💫"
          title="Nenhuma conexao ainda"
          subtitle="Conecte-se com perfis para comecar a interagir!"
          actionLabel="✦ Descobrir perfis"
          onAction={() => navigation.navigate('MainTabs')}
        />
      ) : (
        <FlatList
          data={connections}
          keyExtractor={item => item.userId}
          renderItem={renderConnection}
          contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.md }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.gold} />}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body },
  card: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.md, backgroundColor: COLORS.background, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  profileArea: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: COLORS.gold },
  avatarPlaceholder: { backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: COLORS.gold, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  userName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, flex: 1 },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  // profileBtn/chatBtn removed — now use Button
});

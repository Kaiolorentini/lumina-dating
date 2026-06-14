import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getUserConversations, UserChatPreview } from '../../services/chatsListService';
import { RootStackParamList } from '../../navigation/types';
import Header from '../../components/Header';

export default function SintoniasScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [conversations, setConversations] = useState<UserChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [user]);

  async function loadConversations() {
    if (!user) return;
    try {
      const result = await getUserConversations(user.uid);
      setConversations(result);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }

  function formatTime(date: Date | null): string {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  }

  function renderConversation({ item }: { item: UserChatPreview }) {
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigation.navigate('UserChat', {
          userId: item.userId,
          userName: item.userName,
          userPhoto: item.userPhoto,
        })}
        activeOpacity={0.8}
      >
        <View style={styles.avatarContainer}>
          {item.userPhoto ? (
            <Image source={{ uri: item.userPhoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>👤</Text>
            </View>
          )}
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.userName}>{item.userName}</Text>
            <Text style={styles.time}>{formatTime(item.lastMessageTime)}</Text>
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Sintonias" showBack={false} showHome={false} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Carregando conversas...</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💫</Text>
          <Text style={styles.emptyTitle}>Nenhuma Sintonia ainda</Text>
          <Text style={styles.emptySubtitle}>
            Conecte-se com perfis na aba Descobrir para iniciar conversas reais!
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
          data={conversations}
          keyExtractor={item => item.userId}
          renderItem={renderConversation}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.gold}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  chatItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    gap: spacing.md, backgroundColor: colors.background,
  },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2, borderColor: colors.gold,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  avatarPlaceholderText: { fontSize: 24 },
  chatInfo: { flex: 1 },
  chatHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  userName: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  time: { color: colors.gray, fontSize: fonts.sizes.xs },
  lastMessage: { color: colors.gray, fontSize: fonts.sizes.sm },
  separator: {
    height: 1, backgroundColor: colors.grayDark,
    marginLeft: spacing.lg + 56 + spacing.md,
  },
});
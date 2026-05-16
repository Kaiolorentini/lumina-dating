import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getUserChats, ChatPreview } from '../../services/chatsListService';
 import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import Header from '../../components/Header';
export default function SintoniasScreen() {
  const { user } = useAuth();
 

const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadChats();
  }, []);

  async function loadChats() {
    if (!user) return;
    try {
      const result = await getUserChats(user.uid);
      setChats(result);
    } catch (error) {
      console.error('Erro ao carregar chats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadChats();
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

 function renderChat({ item }: { item: ChatPreview }) {
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigation.navigate('Chat', { model: item.aiModel })}
        activeOpacity={0.8}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: item.aiModel.photoURL }}
            style={styles.avatar}
          />
          <View style={[
            styles.statusDot,
            {
              backgroundColor: item.aiModel.status === 'online'
                ? '#44FF88'
                : item.aiModel.status === 'ocupada'
                ? '#FFB344'
                : colors.gray,
            },
          ]} />
        </View>

        {/* Info do chat */}
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.aiName}>{item.aiModel.name}</Text>
            <Text style={styles.time}>
              {formatTime(item.lastMessageTime)}
            </Text>
          </View>

          <View style={styles.chatFooter}>
            <Text
              style={[
                styles.lastMessage,
                item.unread && styles.lastMessageUnread,
              ]}
              numberOfLines={1}
            >
              {item.unread ? '✦ ' : ''}{item.lastMessage}
            </Text>

            {item.unread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>1</Text>
              </View>
            )}
          </View>

          <Text style={styles.sintonia}>
            {item.aiModel.sintonia}% de Sintonia
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
   {/* Header */}
      <Header
        title="Sintonias"
        showBack={false}
        showHome={false}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Carregando conversas...</Text>
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💫</Text>
          <Text style={styles.emptyTitle}>Nenhuma Sintonia ainda</Text>
          <Text style={styles.emptySubtitle}>
            Visite perfis das IAs na aba Descobrir para iniciar conversas!
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
          data={chats}
          keyExtractor={item => item.aiModel.id}
          renderItem={renderChat}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.gold}
            />
          }
          ItemSeparatorComponent={() => (
            <View style={styles.separator} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
 
 
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: {
    fontSize: 64,
  },
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
  discoverButton: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  discoverButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: fonts.sizes.md,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.background,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiName: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
  },
  time: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
  },
  chatFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    flex: 1,
  },
  lastMessageUnread: {
    color: colors.gold,
    fontWeight: 'bold',
  },
  unreadBadge: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.full,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  unreadBadgeText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: 'bold',
  },
  sintonia: {
    color: colors.gold + '88',
    fontSize: fonts.sizes.xs,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: colors.grayDark,
    marginLeft: spacing.lg + 56 + spacing.md,
  },
});
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import Header from '../../components/Header';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { COLLECTIONS } from '../../core/constants';
import { generateChatId } from '../../modules/chat/services/messageService';
import { getConexoesAceitas } from '../../modules/profile/services/requestsService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface UserChatPreview {
  userId: string;
  userName: string;
  userPhoto: string;
  lastMessage: string;
  lastMessageTime: Date | null;
  unread: boolean;
  unreadCount: number;
}

export default function ConversasScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const [chats, setChats] = useState<UserChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const unsubscribersRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    loadConversas();
    return () => {
      // Limpa todos os listeners ao desmontar
      unsubscribersRef.current.forEach(unsub => unsub());
      unsubscribersRef.current = [];
    };
  }, [user]);

  async function loadConversas() {
    if (!user) return;

    // Limpa listeners antigos antes de recarregar
    unsubscribersRef.current.forEach(unsub => unsub());
    unsubscribersRef.current = [];

    try {
      const conexoes = await getConexoesAceitas(user.uid);
      const previews: UserChatPreview[] = [];

      for (const conexao of conexoes) {
        const otherUserId = conexao.fromUserId === user.uid
          ? conexao.toUserId
          : conexao.fromUserId;

        const chatId = generateChatId(user.uid, otherUserId);
        const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
        const chatSnap = await getDoc(chatRef);

        const otherUserRef = doc(db, COLLECTIONS.USERS, otherUserId);
        const otherUserSnap = await getDoc(otherUserRef);
        const otherUser = otherUserSnap.data();

        if (otherUser) {
          previews.push({
            userId: otherUserId,
            userName: otherUser.name || 'Usuario',
            userPhoto: otherUser.photoURL || '',
            lastMessage: chatSnap.exists()
              ? chatSnap.data()?.lastMessage || 'Sem mensagens'
              : 'Iniciar conversa',
            lastMessageTime: chatSnap.exists()
              ? chatSnap.data()?.lastMessageTime?.toDate() || null
              : null,
            unread: false,
            unreadCount: 0,
          });
        }
      }

      previews.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
      });

      setChats(previews);

      // Escuta mensagens não lidas em tempo real com cleanup
      previews.forEach(chat => {
        const chatId = generateChatId(user.uid, chat.userId);
        const messagesRef = collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES);
        const unreadQ = query(
          messagesRef,
          where('read', '==', false),
          where('senderId', '==', chat.userId)
        );

        const unsub = onSnapshot(unreadQ, snap => {
          setChats(prev => prev.map(c =>
            c.userId === chat.userId
              ? { ...c, unreadCount: snap.size, unread: snap.size > 0 }
              : c
          ));
        });

        unsubscribersRef.current.push(unsub);
      });

    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadConversas();
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

  function renderChat({ item }: { item: UserChatPreview }) {
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
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>
                {item.userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {item.unread && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={[
              styles.userName,
              item.unread && styles.userNameUnread,
            ]}>
              {item.userName}
            </Text>
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
              {item.lastMessage}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unreadCount > 9 ? '9+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Conversas" showBack={false} showHome={false} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Carregando conversas...</Text>
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>Nenhuma conversa ainda</Text>
          <Text style={styles.emptySubtitle}>
            Conecte-se com outros usuarios para comecar a conversar!
          </Text>
          <TouchableOpacity
            style={styles.discoverButton}
            onPress={() => navigation.navigate('MainTabs')}
          >
            <Text style={styles.discoverButtonText}>Descobrir perfis</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={item => item.userId}
          renderItem={renderChat}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: { color: colors.gray, fontSize: fonts.sizes.md },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 64 },
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
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: colors.gold,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.background,
  },
  chatInfo: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
  },
  userNameUnread: { color: colors.gold },
  time: { color: colors.gray, fontSize: fonts.sizes.xs },
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
  lastMessageUnread: { color: colors.white, fontWeight: 'bold' },
  unreadBadge: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: spacing.sm,
  },
  unreadBadgeText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: colors.grayDark,
    marginLeft: spacing.lg + 56 + spacing.md,
  },
});
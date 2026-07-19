import React, { useState, useEffect, useRef } from 'react';
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import Header from '../../components/Header';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { COLLECTIONS } from '../../core/constants';
import { generateChatId } from '../../modules/chat/services/messageService';
import { getConexoesAceitas } from '../../modules/profile/services/requestsService';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';

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
      unsubscribersRef.current.forEach(unsub => unsub());
      unsubscribersRef.current = [];
    };
  }, [user]);

  async function loadConversas() {
    if (!user) return;
    unsubscribersRef.current.forEach(unsub => unsub());
    unsubscribersRef.current = [];

    try {
      const conexoes = await getConexoesAceitas(user.uid);
      const previews: UserChatPreview[] = [];

      for (const conexao of conexoes) {
        const otherUserId = conexao.fromUserId === user.uid ? conexao.toUserId : conexao.fromUserId;
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
            lastMessage: chatSnap.exists() ? chatSnap.data()?.lastMessage || 'Sem mensagens' : 'Iniciar conversa',
            lastMessageTime: chatSnap.exists() ? chatSnap.data()?.lastMessageTime?.toDate() || null : null,
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

      previews.forEach(chat => {
        const chatId = generateChatId(user.uid, chat.userId);
        const messagesRef = collection(db, COLLECTIONS.CHATS, chatId, COLLECTIONS.MESSAGES);
        const unreadQ = query(messagesRef, where('read', '==', false), where('senderId', '==', chat.userId));
        const unsub = onSnapshot(unreadQ, snap => {
          setChats(prev => prev.map(c =>
            c.userId === chat.userId ? { ...c, unreadCount: snap.size, unread: snap.size > 0 } : c
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
        onPress={() => navigation.navigate('UserChat', { userId: item.userId, userName: item.userName, userPhoto: item.userPhoto })}
        activeOpacity={0.8}
      >
        <View style={styles.avatarContainer}>
          {item.userPhoto ? (
            <Image source={{ uri: item.userPhoto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>{item.userName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {item.unread && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={[styles.userName, item.unread && styles.userNameUnread]}>{item.userName}</Text>
            <Text style={styles.time}>{formatTime(item.lastMessageTime)}</Text>
          </View>
          <View style={styles.chatFooter}>
            <Text style={[styles.lastMessage, item.unread && styles.lastMessageUnread]} numberOfLines={1}>{item.lastMessage}</Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
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
          <ActivityIndicator color={COLORS.gold} size="large" />
          <Text style={styles.loadingText}>Carregando conversas...</Text>
        </View>
      ) : chats.length === 0 ? (
        <EmptyState
          icon="💬"
          title="Nenhuma conversa ainda"
          subtitle="Conecte-se com outros usuarios para comecar a conversar!"
          actionLabel="Descobrir perfis"
          onAction={() => navigation.navigate('MainTabs')}
        />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={item => item.userId}
          renderItem={renderChat}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.gold} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body },
  chatItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.md, backgroundColor: COLORS.background },
  avatarContainer: { position: 'relative' },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: COLORS.gold },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: COLORS.gold, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.gold, borderWidth: 2, borderColor: COLORS.background },
  chatInfo: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  userName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  userNameUnread: { color: COLORS.gold },
  time: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  chatFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastMessage: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, flex: 1 },
  lastMessageUnread: { color: COLORS.textPrimary, fontWeight: FONT_WEIGHT.bold },
  unreadBadge: { backgroundColor: COLORS.gold, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, marginLeft: SPACING.sm },
  unreadBadgeText: { color: COLORS.background, fontSize: FONT_SIZE.overline, fontWeight: FONT_WEIGHT.bold },
  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.lg + 56 + SPACING.md },
});

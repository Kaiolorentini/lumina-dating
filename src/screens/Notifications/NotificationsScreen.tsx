import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import {
  Notification,
  listenToNotifications,
  marcarComoLida,
  marcarTodasComoLidas,
} from '../../services/notificationsService';
import Header from '../../components/Header';
import { RootStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  async function handleMarkAllRead() {
    if (!user) return;
    await marcarTodasComoLidas(user.uid);
  }

  async function handleNotificationPress(notification: Notification) {
    await marcarComoLida(notification.id);
  }

  function formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}min atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return `${days}d atrás`;
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  function renderNotification({ item }: { item: Notification }) {
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.read && styles.notificationItemUnread,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{item.icon}</Text>
          {!item.read && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.content}>
          <Text style={[
            styles.message,
            !item.read && styles.messageUnread,
          ]}>
            {item.message}
          </Text>
          <Text style={styles.time}>{formatTime(item.timestamp)}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Notificações"
        showBack={true}
        showHome={true}
        rightElement={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAllRead}>
              <Text style={styles.markAllRead}>Ler todas</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.gold} size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
          <Text style={styles.emptySubtitle}>
            Suas notificações aparecerão aqui
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={renderNotification}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllRead: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  notificationItemUnread: {
    backgroundColor: COLORS.gold + '11',
  },
  iconContainer: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  icon: {
    fontSize: FONT_SIZE.title,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.body,
    lineHeight: 22,
  },
  messageUnread: {
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.bold,
  },
  time: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: SPACING.lg + 44 + SPACING.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  emptyIcon: {
    fontSize: 60,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
  },
});

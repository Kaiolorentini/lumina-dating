import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { AppNotification } from '../../../shared/types';
import { formatRelativeTime } from '../../../shared/utils';
import Header from '../../../components/Header';

// ============================================
// NOTIFICATIONS SCREEN — MÓDULO NOTIFICATIONS
// Screen limpa: apenas renderiza UI.
// ============================================

export default function NotificationsScreen() {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
  } = useNotifications(user?.uid);

  function renderNotification({ item }: { item: AppNotification }) {
    return (
      <TouchableOpacity
        style={[
          styles.item,
          !item.read && styles.itemUnread,
        ]}
        onPress={() => markRead(item.id)}
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
          <Text style={styles.time}>
            {formatRelativeTime(item.timestamp)}
          </Text>
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
            <TouchableOpacity onPress={markAllRead}>
              <Text style={styles.markAllRead}>Ler todas</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.gold} size="large" />
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
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllRead: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  itemUnread: {
    backgroundColor: colors.gold + '11',
  },
  iconContainer: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  icon: { fontSize: 20 },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.background,
  },
  content: { flex: 1 },
  message: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
    lineHeight: 22,
  },
  messageUnread: {
    color: colors.white,
    fontWeight: 'bold',
  },
  time: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    marginTop: spacing.xs,
  },
  separator: {
    height: 1,
    backgroundColor: colors.grayDark,
    marginLeft: spacing.lg + 44 + spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 60 },
  emptyTitle: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
  },
  emptySubtitle: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
  },
});
// ============================================
// LUMINA — NOTIFICATIONS SCREEN v5.2
// src/modules/notifications/screens/NotificationsScreen.tsx
//
// v5.2: Integração com TriggerNotificationModal
// Tocar em notificação de gatilho emocional
// abre o modal correto.
// ============================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useNavigation }  from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius, alpha } from '../../../theme';
import { useAuth }           from '../../../context/AuthContext';
import { useNotifications }  from '../hooks/useNotifications';
import { AppNotification }   from '../../../shared/types';
import { formatRelativeTime } from '../../../shared/utils';
import Header                from '../../../components/Header';
import TriggerNotificationModal, { TriggerType } from '../../../components/TriggerNotificationModal';
import { ErrorState }        from '../../../components/ui';
import { RootStackParamList } from '../../../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Tipos que abrem o modal de gatilho
const TRIGGER_TYPES: TriggerType[] = [
  'quase_sintonia',
  'sintonia_perdida',
  'pensou_em_voce',
  'cofre_cheio',
];

function isTriggerType(type: string): type is TriggerType {
  return TRIGGER_TYPES.includes(type as TriggerType);
}

export default function NotificationsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const {
    notifications, unreadCount,
    loading, error, reload, markRead, markAllRead,
  } = useNotifications(user?.uid);

  // Estado do modal de gatilho
  const [triggerModal, setTriggerModal] = useState<{
    visible:    boolean;
    type:       TriggerType;
    sintonia?:  number;
    visitorId?: string;
    fragments?: number;
  }>({
    visible:   false,
    type:      'quase_sintonia',
  });

  function handleNotificationPress(item: AppNotification) {
    // Marca como lida
    markRead(item.id);

    // Se for gatilho emocional → abre modal
    if (isTriggerType(item.type)) {
      setTriggerModal({
        visible:   true,
        type:      item.type as TriggerType,
        sintonia:  item.dados?.sintonia,
        visitorId: item.dados?.visitorId,
        fragments: item.dados?.fragments,
      });
      return;
    }

    // Outras notificações → navegação normal
    switch (item.type) {
      case 'sintonia':
        navigation.navigate('MainTabs');
        break;
      case 'mensagem':
        navigation.navigate('MainTabs', { screen: 'Sintonias' } as any);
        break;
      case 'promocao':
        navigation.navigate('MainTabs', { screen: 'Store' } as any);
        break;
      default:
        break;
    }
  }

  function renderNotification({ item }: { item: AppNotification }) {
    const isTrigger = isTriggerType(item.type);

    return (
      <TouchableOpacity
        style={[
          styles.item,
          !item.read && styles.itemUnread,
          isTrigger && styles.itemTrigger,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={item.read ? item.message : `Nova notificação: ${item.message}`}
      >
        <View style={[
          styles.iconContainer,
          isTrigger && styles.iconContainerTrigger,
        ]}>
          <Text style={styles.icon}>{item.icon}</Text>
          {!item.read && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.content}>
          {/* Título para gatilhos emocionais */}
          {isTrigger && item.dados?.title && (
            <Text style={styles.triggerTitle}>{item.dados.title}</Text>
          )}
          <Text style={[
            styles.message,
            !item.read && styles.messageUnread,
          ]}>
            {item.message}
          </Text>
          <View style={styles.bottomRow}>
            <Text style={styles.time}>
              {formatRelativeTime(item.timestamp)}
            </Text>
            {isTrigger && !item.read && (
              <Text style={styles.tapToReveal}>Toque para ver ›</Text>
            )}
          </View>
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
      ) : error ? (
        <ErrorState onRetry={reload} title="Falha ao carregar" message="Não foi possível carregar suas notificações." />
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

      {/* Modal de gatilho emocional */}
      <TriggerNotificationModal
        visible={triggerModal.visible}
        type={triggerModal.type}
        sintonia={triggerModal.sintonia}
        visitorId={triggerModal.visitorId}
        fragments={triggerModal.fragments}
        onClose={() => setTriggerModal(prev => ({ ...prev, visible: false }))}
        onNavigate={(userId) => navigation.navigate('RealProfile', { userId })}
        onGoToStore={() => navigation.navigate('MainTabs', { screen: 'Store' } as any)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markAllRead:      { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },

  item:             { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  itemUnread:       { backgroundColor: colors.gold + '11' },
  itemTrigger:      { backgroundColor: alpha(colors.primaryLegacy, 0.08) },

  iconContainer:        { position: 'relative', width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.grayDark },
  iconContainerTrigger: { borderColor: colors.primaryLegacy },

  icon:             { fontSize: fonts.sizes.xl },
  unreadDot:        { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.background },

  content:          { flex: 1 },
  triggerTitle:     { color: colors.secondaryLegacy, fontSize: fonts.sizes.sm, fontWeight: 'bold', marginBottom: 2 },
  message:          { color: colors.gray, fontSize: fonts.sizes.md, lineHeight: 22 },
  messageUnread:    { color: colors.white, fontWeight: 'bold' },
  bottomRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  time:             { color: colors.gray, fontSize: fonts.sizes.xs },
  tapToReveal:      { color: colors.primaryLegacy, fontSize: fonts.sizes.xs, fontWeight: 'bold' },

  separator:        { height: 1, backgroundColor: colors.grayDark, marginLeft: spacing.lg + 44 + spacing.md },
  emptyContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyIcon:        { fontSize: 60 },
  emptyTitle:       { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  emptySubtitle:    { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
});
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
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation }  from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { useAuth }           from '../../../context/AuthContext';
import { useNotifications }  from '../hooks/useNotifications';
import { AppNotification }   from '../../../shared/types';
import { formatRelativeTime } from '../../../shared/utils';
import Header                from '../../../components/Header';
import TriggerNotificationModal, { TriggerType } from '../../../components/TriggerNotificationModal';
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

/**
 * Lê um texto de `dados` com segurança. O servidor grava ali o
 * contexto da notificação (quem curtiu, com quem sintonizou), e
 * notificações antigas podem não ter o campo.
 */
function dadosString(item: AppNotification, key: string): string | null {
  const value = (item.dados as unknown as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export default function NotificationsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const {
    notifications, unreadCount,
    loading, markRead, markAllRead,
  } = useNotifications(user?.uid);

  // Estado do modal de gatilho
  const [triggerModal, setTriggerModal] = useState<{
    visible:    boolean;
    type:       TriggerType;
    sintonia?:       number;
    notificationId?: string;
    fragments?:      number;
  }>({
    visible:   false,
    type:      'quase_sintonia',
  });

  function handleNotificationPress(item: AppNotification) {
    markRead(item.id);

    // Gatilho emocional → modal de revelação
    if (isTriggerType(item.type)) {
      setTriggerModal({
        visible:   true,
        type:      item.type as TriggerType,
        sintonia:       item.dados?.sintonia,
        // Só o id da notificação: quem visitou é revelado pelo
        // servidor (revealTrigger), nunca lido daqui.
        notificationId: item.id,
        fragments:      item.dados?.fragments,
      });
      return;
    }

    // Cada tipo leva à tela onde o assunto está. A mesma tabela vale
    // para o toque no push (AppNavigator) — manter as duas iguais.
    switch (item.type) {
      // ── Conexões e conversas ──
      case 'sintonia':
        navigation.navigate('MainTabs');
        break;
      case 'mensagem':
      case 'message':
      case 'request_accepted':
        navigation.navigate('MainTabs', { screen: 'Sintonias' } as never);
        break;
      case 'request':
        navigation.navigate('Requests');
        break;
      case 'like_received': {
        // Texto anônimo; o toque revela quem curtiu.
        const likedBy = dadosString(item, 'likedBy');
        if (likedBy) navigation.navigate('RealProfile', { userId: likedBy });
        break;
      }
      case 'sintonia_criada': {
        const sintoniaWith = dadosString(item, 'sintoniaWith');
        if (sintoniaWith) navigation.navigate('RealProfile', { userId: sintoniaWith });
        break;
      }

      // ── Loja, impulsos e Galáxia Plus ──
      case 'promocao':
      case 'coins_purchased':
        navigation.navigate('MainTabs', { screen: 'Store' } as never);
        break;
      case 'galaxia_plus_activated':
      case 'galaxia_turbos_expiring':
        navigation.navigate('GalaxiaPlus');
        break;
      // Relatório do impulso: leva à loja para impulsionar de novo.
      case 'boost_report':
      case 'destaque_aberto':
      case 'visibilidade_caindo':
        navigation.navigate('Boosts');
        break;

      // ── Gamificação ──
      case 'cofre_pronto':
        navigation.navigate('Vault');
        break;
      case 'level_up':
      case 'tree_evolution':
        navigation.navigate('XP');
        break;
      case 'achievement_unlocked':
      case 'collection_complete':
        navigation.navigate('Achievements');
        break;
      case 'ranking_reward':
        navigation.navigate('Ranking');
        break;
      case 'prestige_marco':
      case 'prestige_stage':
      case 'prestige_evolution':
        navigation.navigate('Prestige');
        break;
      case 'streak_risco':
        navigation.navigate('MainTabs');
        break;

      // ── Marketplace: comprador ──
      case 'purchase_confirmed':
      case 'refund_processed':
        navigation.navigate('MyPurchases');
        break;
      case 'screenshot_warning':
        Alert.alert('⚠️ Aviso', item.message);
        break;

      // ── Marketplace: criador ──
      case 'creator_approved':
      case 'product_approved':
      case 'product_rejected':
      case 'marketplace_unbanned':
        navigation.navigate('MyProducts');
        break;
      case 'creator_rejected':
        navigation.navigate('CreatorRequest');
        break;
      case 'sale_completed':
      case 'sale_refunded':
      case 'withdrawal_approved':
      case 'withdrawal_paid':
      case 'withdrawal_rejected':
        navigation.navigate('MyEarnings');
        break;

      // ── Conta e suporte ──
      case 'marketplace_banned':
      case 'age_verification_rejected':
        navigation.navigate('Support');
        break;
      case 'support_reply':
      case 'support_new': {
        const ticketId = dadosString(item, 'ticketId');
        if (ticketId) navigation.navigate('SupportTicket', { ticketId });
        else navigation.navigate('Support');
        break;
      }

      // ── Admin ──
      case 'product_review_new': {
        const productId = dadosString(item, 'productId');
        if (productId) navigation.navigate('AdminProductReview', { productId });
        else navigation.navigate('AdminProductsModeration');
        break;
      }
      case 'product_pending':
        navigation.navigate('AdminProductsModeration');
        break;
      case 'creator_request':
        navigation.navigate('AdminCreatorRequests');
        break;
      case 'withdrawal_request':
        navigation.navigate('AdminWithdrawals');
        break;
      case 'refund_requested':
        navigation.navigate('AdminRefundRequests');
        break;
      case 'fraud_flag':
        navigation.navigate('AdminFraudFlags');
        break;
      case 'inflation_alert':
        navigation.navigate('AdminInflation');
        break;
      case 'age_verification_pending':
        navigation.navigate('AdminAgeVerification');
        break;
      case 'admin_sale':
        navigation.navigate('AdminSales');
        break;
      case 'gallery_photo_removed':
        navigation.navigate('MainTabs', { screen: 'Profile' } as never);
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
        notificationId={triggerModal.notificationId}
        fragments={triggerModal.fragments}
        onClose={() => setTriggerModal(prev => ({ ...prev, visible: false }))}
        onNavigate={(userId) => navigation.navigate('RealProfile', { userId })}
        onGoToStore={() => navigation.navigate('MainTabs', { screen: 'Store' } as any)}
        onOpenVault={() => navigation.navigate('Vault')}
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
  itemTrigger:      { backgroundColor: 'rgba(123,47,190,0.08)' },

  iconContainer:        { position: 'relative', width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.grayDark },
  iconContainerTrigger: { borderColor: '#7B2FBE' },

  icon:             { fontSize: 20 },
  unreadDot:        { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.background },

  content:          { flex: 1 },
  triggerTitle:     { color: '#B57BEE', fontSize: fonts.sizes.sm, fontWeight: 'bold', marginBottom: 2 },
  message:          { color: colors.gray, fontSize: fonts.sizes.md, lineHeight: 22 },
  messageUnread:    { color: colors.white, fontWeight: 'bold' },
  bottomRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  time:             { color: colors.gray, fontSize: fonts.sizes.xs },
  tapToReveal:      { color: '#7B2FBE', fontSize: fonts.sizes.xs, fontWeight: 'bold' },

  separator:        { height: 1, backgroundColor: colors.grayDark, marginLeft: spacing.lg + 44 + spacing.md },
  emptyContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyIcon:        { fontSize: 60 },
  emptyTitle:       { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  emptySubtitle:    { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
});
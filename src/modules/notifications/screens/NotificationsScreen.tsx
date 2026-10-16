// ============================================
// LUMINA — NOTIFICATIONS SCREEN v5.3
// src/modules/notifications/screens/NotificationsScreen.tsx
//
// v5.2: Integração com TriggerNotificationModal
// Tocar em notificação de gatilho emocional
// abre o modal correto.
//
// v5.3 (11/10/2026): coleção completa abre Conquistas direto na
// aba Coleções, onde fica o botão "Coletar".
//
// v5.4 (14/10/2026, web T3): FILTROS E DIAS.
// A lista era uma coluna única misturando curtida, compra e nível.
// Agora: filtros no topo (Todas · Não lidas · Conexões · Loja ·
// Conquistas) e a lista separada por dia (Hoje, Ontem, Esta semana,
// Anteriores). Mesmas notificações, mesma escuta (useNotifications):
// nenhuma leitura a mais. O toque leva aos mesmos lugares.
// ============================================

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, SectionList, ScrollView,
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

type NotifFilter = 'todas' | 'nao_lidas' | 'conexoes' | 'loja' | 'conquistas';

const FILTERS: { key: NotifFilter; label: string }[] = [
  { key: 'todas',      label: 'Todas' },
  { key: 'nao_lidas',  label: 'Não lidas' },
  { key: 'conexoes',   label: '💬 Conexões' },
  { key: 'loja',       label: '💎 Loja' },
  { key: 'conquistas', label: '🏆 Conquistas' },
];

/** Tipos de cada filtro (os mesmos do switch de navegação abaixo).
 *  Vendas, suporte e admin aparecem em "Todas" e "Não lidas". */
const FILTER_TYPES: Record<'conexoes' | 'loja' | 'conquistas', Set<string>> = {
  conexoes: new Set([
    'sintonia', 'mensagem', 'message', 'request_accepted', 'request', 'like_received',
    'sintonia_criada', 'quase_sintonia', 'sintonia_perdida', 'pensou_em_voce',
  ]),
  loja: new Set([
    'promocao', 'coins_purchased', 'galaxia_plus_activated', 'galaxia_turbos_expiring',
    'boost_report', 'destaque_aberto', 'visibilidade_caindo',
    'purchase_confirmed', 'refund_processed',
  ]),
  conquistas: new Set([
    'cofre_pronto', 'cofre_cheio', 'level_up', 'tree_evolution', 'achievement_unlocked',
    'collection_complete', 'ranking_reward', 'prestige_marco', 'prestige_stage',
    'prestige_evolution', 'streak_risco',
  ]),
};

function matchesFilter(item: AppNotification, filter: NotifFilter): boolean {
  if (filter === 'todas') return true;
  if (filter === 'nao_lidas') return !item.read;
  return FILTER_TYPES[filter].has(item.type);
}

/** Separa por dia: Hoje, Ontem, Esta semana, Anteriores. */
function groupByDay(items: AppNotification[]): { title: string; data: AppNotification[] }[] {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const DAY = 86_400_000;
  const buckets: Record<string, AppNotification[]> = { Hoje: [], Ontem: [], 'Esta semana': [], Anteriores: [] };
  items.forEach(item => {
    const t = item.timestamp instanceof Date ? item.timestamp.getTime() : new Date(item.timestamp as unknown as string).getTime();
    if (t >= startToday) buckets.Hoje.push(item);
    else if (t >= startToday - DAY) buckets.Ontem.push(item);
    else if (t >= startToday - 6 * DAY) buckets['Esta semana'].push(item);
    else buckets.Anteriores.push(item);
  });
  return Object.entries(buckets)
    .filter(([, data]) => data.length > 0)
    .map(([title, data]) => ({ title, data }));
}

export default function NotificationsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const {
    notifications, unreadCount,
    loading, markRead, markAllRead,
  } = useNotifications(user?.uid);
  const [filter, setFilter] = useState<NotifFilter>('todas');
  const sections = useMemo(
    () => groupByDay(notifications.filter(n => matchesFilter(n, filter))),
    [notifications, filter],
  );

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
        navigation.navigate('Achievements');
        break;
      case 'collection_complete':
        navigation.navigate('Achievements', { initialTab: 'colecoes' });
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
        <>
          <View style={styles.filtersBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {FILTERS.map(f => {
                const active = filter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setFilter(f.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>
                      {f.label}{f.key === 'nao_lidas' && unreadCount > 0 ? ` · ${unreadCount}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            renderItem={renderNotification}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionHeader}>{section.title}</Text>
            )}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.filterEmpty}>
                <Text style={styles.emptySubtitle}>
                  {filter === 'nao_lidas' ? 'Tudo lido por aqui. ✦' : 'Nenhuma notificação nesta categoria.'}
                </Text>
              </View>
            }
          />
        </>
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

  filtersBar:       { borderBottomWidth: 1, borderBottomColor: colors.grayDark },
  filters:          { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  filterChip:       { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.grayDark, backgroundColor: colors.surface },
  filterChipActive: { borderColor: colors.gold, backgroundColor: colors.gold + '22' },
  filterText:       { color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  filterTextActive: { color: colors.gold },
  sectionHeader:    { color: colors.gold, fontSize: fonts.sizes.xs, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs, backgroundColor: colors.background },
  filterEmpty:      { paddingTop: 60, alignItems: 'center' },
  separator:        { height: 1, backgroundColor: colors.grayDark, marginLeft: spacing.lg + 44 + spacing.md },
  emptyContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyIcon:        { fontSize: 60 },
  emptyTitle:       { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  emptySubtitle:    { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
});


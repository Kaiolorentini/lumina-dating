// ============================================
// LUMINA — NOTIFICATION SERVICE v5.3
// src/modules/notifications/services/notificationService.ts
//
// v5.3: level_up, tree_evolution, achievement_unlocked,
//       collection_complete adicionados
// ============================================

import {
  collection, addDoc, query, where, orderBy,
  onSnapshot, updateDoc, doc, writeBatch,
  getDocs, serverTimestamp, limit,
} from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';
import { NotificationType, AppNotification } from '../../../shared/types';

export function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    sintonia:             '✦',
    mensagem:             '💬',
    promocao:             '💰',
    creator_approved:     '🎨',
    creator_rejected:     '❌',
    product_approved:     '✅',
    product_rejected:     '❌',
    withdrawal_approved:  '💸',
    withdrawal_rejected:  '❌',
    withdrawal_paid:      '💰',
    refund_processed:     '↩️',
    quase_sintonia:       '💜',
    sintonia_perdida:     '💔',
    pensou_em_voce:       '✨',
    cofre_cheio:          '🗝️',
    streak_risco:         '🔥',
    visibilidade_caindo:  '📉',
    // v5.3 — XP + Conquistas
    level_up:             '⬆️',
    tree_evolution:       '🌳',
    achievement_unlocked: '🏆',
    collection_complete:  '📚',
    // v5.4 — Ranking semanal
    ranking_reward:       '🏅',
    inflation_alert:      '⚠️',
    // v5.5 — sintonia, curtida recebida e compras
    sintonia_criada:        '✦',
    like_received:          '💜',
    coins_purchased:        '💎',
    galaxia_plus_activated: '🌌',
    cofre_pronto:           '🗝️',
    galaxia_turbos_expiring: '⚡',
    boost_report:           '🚀',
    destaque_aberto:        '📍',
    support_reply:          '💬',
    support_new:            '🆘',
    sale_refunded:          '↩️',
    sale_completed:         '🎉',
    purchase_confirmed:     '📦',
    message:                '💬',
    request:                '✦',
    request_accepted:       '✨',
    prestige_marco:         '👑',
    prestige_stage:         '👑',
    prestige_evolution:     '👑',
    marketplace_banned:     '🚫',
    marketplace_unbanned:   '✅',
    screenshot_warning:     '⚠️',
    age_verification_approved: '✅',
    age_verification_rejected: '🪪',
    age_verification_pending:  '🪪',
    product_review_new:     '📦',
    product_pending:        '📦',
    creator_request:        '🎨',
    withdrawal_request:     '💸',
    refund_requested:       '↩️',
    fraud_flag:             '🚨',
    admin_sale:             '💰',
    gallery_photo_removed:  '📷',
  };
  return icons[type] ?? '🔔';
}

export async function createNotification(
  userId:  string,
  type:    NotificationType,
  message: string
): Promise<void> {
  try {
    await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
      userId,
      type,
      message,
      read:      false,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('[notificationService] Erro ao criar notificação:', error);
  }
}

export function listenToNotifications(
  userId:   string,
  onUpdate: (notifications: AppNotification[]) => void
): () => void {
  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(50)
  );

  return onSnapshot(q, snapshot => {
    const notifications: AppNotification[] = snapshot.docs.map(d => ({
      id:        d.id,
      userId:    d.data().userId,
      type:      d.data().type,
      message:   d.data().message,
      read:      d.data().read,
      timestamp: d.data().timestamp?.toDate() || new Date(),
      icon:      getNotificationIcon(d.data().type),
      dados:     d.data().dados ?? undefined,
    }));
    onUpdate(notifications);
  });
}

export async function markAsRead(notificationId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
  await updateDoc(ref, { read: true });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('userId', '==', userId),
    where('read', '==', false)
  );
  const snapshot = await getDocs(q);
  const batch    = writeBatch(db);
  snapshot.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}

/**
 * Marca como lidas as notificações de certos tipos — usado ao abrir
 * Minhas Compras, Meus Produtos e Meus Ganhos, para o balão da área
 * sumir junto.
 */
export async function markNotificationsReadByTypes(userId: string, types: string[]): Promise<void> {
  if (types.length === 0) return;
  const snapshot = await getDocs(query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('userId', '==', userId),
    where('read', '==', false),
    where('type', 'in', types.slice(0, 30)),
  ));
  if (snapshot.empty) return;
  const batch = writeBatch(db);
  snapshot.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}
// ============================================
// LUMINA — NOTIFICATIONS SERVICE (compat) v5.1
// src/services/notificationsService.ts
//
// CORREÇÃO: generateAutoNotifications removido.
// Notificações geradas via Cloud Functions.
// Este arquivo mantém re-exports para
// compatibilidade com imports antigos.
// ============================================

export {
  createNotification  as adicionarNotificacao,
  createNotification,
  listenToNotifications,
  markAsRead          as marcarComoLida,
  markAllAsRead       as marcarTodasComoLidas,
  getNotificationIcon,
} from '../modules/notifications/services/notificationService';

export type { AppNotification as Notification } from '../shared/types';
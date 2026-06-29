// ============================================
// LUMINA — NOTIFICATIONS MODULE INDEX v5.1
// src/modules/notifications/index.ts
//
// CORREÇÃO: generateAutoNotifications removido.
// Não existe mais — notificações geradas via
// Cloud Functions (triggers Firestore).
// ============================================

export { default as NotificationsScreen } from './screens/NotificationsScreen';
export { useNotifications }               from './hooks/useNotifications';
export { usePushNotifications }           from './hooks/usePushNotifications';
export {
  createNotification,
  markAsRead,
  markAllAsRead,
  getNotificationIcon,
  listenToNotifications,
} from './services/notificationService';
export {
  registerForPushNotifications,
  sendPushNotification,
  sendPushToUser,
  getPushToken,
} from './services/pushService';
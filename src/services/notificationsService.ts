// Compatibilidade — re-exporta do módulo novo
export {
  createNotification as adicionarNotificacao,
  createNotification,
  listenToNotifications,
  markAsRead as marcarComoLida,
  markAllAsRead as marcarTodasComoLidas,
  generateAutoNotifications as gerarNotificacoesAutomaticas,
  getNotificationIcon,
} from '../modules/notifications/services/notificationService';

// Tipos — compatibilidade com imports antigos
export type { AppNotification as Notification } from '../shared/types';
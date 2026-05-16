import { usePushNotifications } from '../hooks/usePushNotifications';

// ============================================
// PUSH INITIALIZER
//
// Componente invisível que inicializa
// push notifications ao fazer login.
// Adicione dentro do AppNavigator.
// ============================================

export default function PushInitializer() {
  usePushNotifications();
  return null;
}
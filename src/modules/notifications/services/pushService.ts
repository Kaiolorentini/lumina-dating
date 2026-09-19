import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../../core/firebase';

// ============================================
// PUSH SERVICE — MÓDULO NOTIFICATIONS
//
// v2: o ENVIO saiu daqui. Antes este arquivo lia o token de
// qualquer usuário (getPushToken) e chamava a API do Expo
// com título e corpo livres (sendPushNotification,
// sendPushToUser): qualquer conta logada mandava "Você
// ganhou 500 cristais, toque aqui" com o nome do Lumina para
// qualquer pessoa. Phishing dentro do app.
//
// Agora o envio é a CF sendUserPush: o cliente informa o
// EVENTO e o destinatário, o servidor valida a relação, monta
// o texto de um catálogo fixo e envia. O token nunca sai do
// servidor.
// ============================================

// Genéricos em tipos nomeados: httpsCallable< em fim de linha
// é corrompido ao colar.
interface RegisterPushTokenPayload {
  token: string;
}

interface RegisterPushTokenResult {
  success: boolean;
}

export type UserPushEvent =
  | 'chat_message'
  | 'connection_request'
  | 'connection_accepted';

interface SendUserPushPayload {
  targetUserId: string;
  event: UserPushEvent;
  chatId?: string;
}

interface SendUserPushResult {
  sent: boolean;
  reason: string | null;
}

// Configura comportamento das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Solicita permissão e retorna o token
export async function registerForPushNotifications(
  userId: string
): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      console.log('Push nao suportado no web');
      return null;
    }

    if (!Device.isDevice) {
      console.log('Push so funciona em dispositivos fisicos');
      return null;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permissao de push negada');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Lumina Dating',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4AF37',
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('projectId nao configurado no app.json');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    await savePushToken(userId, token);
    return token;
  } catch (error) {
    console.error('Erro ao registrar push:', error);
    return null;
  }
}

// Registra o token pela Cloud Function.
//
// O cliente não grava mais direto: o campo users/{uid}.pushToken
// virou protegido nas rules, porque a coleção tem `allow list`
// aberto e qualquer conta logada lia o token de todo mundo. A CF
// grava em users/{uid}/private/push, fechado nos dois sentidos.
//
// O userId vem por compatibilidade com o chamador; a CF usa o
// uid do token de autenticação, não este parâmetro.
export async function savePushToken(
  userId: string,
  token: string
): Promise<void> {
  try {
    const fn = httpsCallable<RegisterPushTokenPayload, RegisterPushTokenResult>(
      getFunctions(app, 'us-central1'),
      'registerPushToken',
    );
    await fn({ token });
    console.log('Push Token registrado!');
  } catch (error) {
    console.error('[pushService] Erro ao registrar push token:', error);
  }
}

/**
 * Notifica outro usuário sobre um evento.
 *
 * O cliente NÃO escolhe o texto: informa só o evento, e o
 * servidor monta a mensagem e valida a relação (conexão
 * aceita, bloqueio mútuo, limite por hora).
 *
 * Falha silenciosa por design: push é secundário e não pode
 * derrubar o envio da mensagem nem da solicitação.
 */
export async function notifyUserOfEvent(
  targetUserId: string,
  event: UserPushEvent,
  chatId?: string,
): Promise<void> {
  try {
    const fn = httpsCallable<SendUserPushPayload, SendUserPushResult>(
      getFunctions(app, 'us-central1'),
      'sendUserPush',
    );
    const result = await fn({ targetUserId, event, chatId });

    if (!result.data.sent) {
      console.log(`[pushService] Push nao enviado: ${result.data.reason}`);
    }
  } catch (error) {
    console.warn('[pushService] Erro ao notificar:', error);
  }
}
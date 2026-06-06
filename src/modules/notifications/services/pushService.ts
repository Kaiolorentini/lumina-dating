import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';

// ============================================
// PUSH SERVICE — MÓDULO NOTIFICATIONS
// ============================================

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

    console.log('Device.isDevice:', Device.isDevice);
    console.log('Platform.OS:', Platform.OS);

    if (!Device.isDevice) {
      console.log('Push so funciona em dispositivos fisicos');
      return null;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    
    console.log('Status permissao atual:', existingStatus);

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('Novo status permissao:', finalStatus);
    }

    if (finalStatus !== 'granted') {
      console.log('Permissao negada!');
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

    console.log('ProjectId:', projectId);

    if (!projectId) {
      console.warn('projectId nao configurado no app.json');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    console.log('Push Token obtido:', token);

    await savePushToken(userId, token);
    console.log('Push Token salvo no Firestore!');
    return token;
  } catch (error) {
    console.error('Erro ao registrar push:', error);
    return null;
  }
}

// Salva token no Firestore
export async function savePushToken(
  userId: string,
  token: string
): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  await setDoc(
    userRef,
    { pushToken: token, pushTokenUpdatedAt: new Date() },
    { merge: true }
  );
}

// Busca token de um usuário
export async function getPushToken(
  userId: string
): Promise<string | null> {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) return snap.data().pushToken || null;
    return null;
  } catch {
    return null;
  }
}

// Envia notificação via Expo Push API
export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        sound: 'default',
        title,
        body,
        data: data || {},
        badge: 1,
      }),
    });

    const result = await response.json();
    console.log('✅ Push enviado:', result);
  } catch (error) {
    console.error('Erro ao enviar push:', error);
  }
}

// Envia push para usuário pelo userId
export async function sendPushToUser(
  targetUserId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  const token = await getPushToken(targetUserId);
  if (!token) {
    console.log('⚠️ Usuário sem push token:', targetUserId);
    return;
  }
  await sendPushNotification(token, title, body, data);
}
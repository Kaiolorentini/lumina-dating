// ============================================
// NOTIFY USER — UTILITÁRIO CENTRALIZADO
//
// Envia push + in-app notification para usuário.
// Usado por todas as Cloud Functions que precisam
// notificar o usuário sobre ações do admin.
//
// v2: token lido pelo helper (users/{uid}/private/push, com
// fallback para o campo antigo) e envio pelo expoPush, que
// CONFERE a resposta do Expo. A versão anterior lia o campo
// direto e imprimia "Notificado" mesmo quando o Expo recusava
// o envio — a API responde 200 com o erro no corpo.
// ============================================

import * as admin from "firebase-admin";
import { getPushToken, deletePushToken } from "./pushTokens";
import { sendExpoPush } from "./expoPush";

interface NotifyUserParams {
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, string>;
}

// Cria notificação in-app no Firestore
async function createInAppNotification(
  userId: string,
  type: string,
  message: string
): Promise<void> {
  try {
    await admin.firestore().collection("notifications").add({
      userId,
      type,
      message,
      read: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.warn("[notifyUser] Erro ao criar in-app notification:", error);
  }
}

// Função principal — push + in-app
export async function notifyUser({
  userId,
  title,
  body,
  type,
  data = {},
}: NotifyUserParams): Promise<void> {
  try {
    const pushToken = await getPushToken(userId);

    if (pushToken) {
      const result = await sendExpoPush(pushToken, title, body, { type, ...data });

      if (result.sent) {
        console.log(`[notifyUser] Push enviado: ${userId} — ${type}`);
      } else {
        console.warn(
          `[notifyUser] Push recusado (${result.errorCode}) para ${userId}: ${result.message ?? ""}`,
        );
        // Token morto some: sem isto, toda notificação futura
        // tentaria o mesmo destino inexistente.
        if (result.errorCode === "DeviceNotRegistered") {
          await deletePushToken(userId);
        }
      }
    } else {
      console.warn(`[notifyUser] Sem pushToken para userId: ${userId}`);
    }

    // In-app sempre — independe do push.
    await createInAppNotification(userId, type, body);
  } catch (error) {
    console.warn("[notifyUser] Erro:", error);
  }
}
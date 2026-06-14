// ============================================
// NOTIFY USER — UTILITÁRIO CENTRALIZADO
//
// Envia push + in-app notification para usuário.
// Usado por todas as Cloud Functions que precisam
// notificar o usuário sobre ações do admin.
// ============================================

import * as admin from "firebase-admin";

interface NotifyUserParams {
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, string>;
}

// Envia push via Expo Push API
async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<void> {
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data,
        sound: "default",
        priority: "high",
      }),
    });
  } catch (error) {
    console.warn("[notifyUser] Erro ao enviar push:", error);
  }
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
    const userSnap = await admin.firestore()
      .collection("users")
      .doc(userId)
      .get();

    const pushToken = userSnap.data()?.pushToken;

    // Push (falha silenciosa se sem token)
    if (pushToken && typeof pushToken === "string" && pushToken.length > 0) {
      await sendExpoPush(pushToken, title, body, { type, ...data });
    } else {
      console.warn(`[notifyUser] Sem pushToken para userId: ${userId}`);
    }

    // In-app sempre
    await createInAppNotification(userId, type, body);

    console.log(`[notifyUser] Notificado userId: ${userId} — ${type}`);
  } catch (error) {
    console.warn("[notifyUser] Erro:", error);
  }
}
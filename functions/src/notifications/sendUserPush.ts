// ============================================
// LUMINA — PUSH ENTRE USUÁRIOS
// functions/src/notifications/sendUserPush.ts
//
// Substitui o sendPushToUser do cliente. O app informa o
// evento e o destinatário; o servidor valida a relação, monta
// o texto do catálogo e envia. O cliente nunca vê o token nem
// escolhe o texto.
//
// RATE LIMIT por remetente: sem ele, um script chama esta CF
// num laço e transforma push legítimo em spam. 30 por hora
// cobre conversa intensa e corta abuso.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated } from "../utils/adminGuard";
import { getPushToken, deletePushToken } from "../utils/pushTokens";
import { sendExpoPush } from "../utils/expoPush";
import { buildPushContent, PUSH_EVENTS, PushEvent } from "./pushCatalog";

const RATE_LIMIT_PER_HOUR = 30;

interface SendUserPushPayload {
  targetUserId: string;
  event: PushEvent;
  /** Extras de navegação. Só chaves conhecidas passam. */
  chatId?: string;
}

interface SendUserPushResult {
  sent: boolean;
  reason: string | null;
}

/**
 * Conexão aceita entre os dois, em qualquer direção. Mesma
 * lógica do estaoConectados do cliente — aqui ela vale, porque
 * o cliente pode ser modificado.
 */
async function areConnected(uidA: string, uidB: string): Promise<boolean> {
  const db = admin.firestore();
  const col = db.collection("connectionRequests");

  const [fromA, fromB] = await Promise.all([
    col
      .where("fromUserId", "==", uidA)
      .where("toUserId", "==", uidB)
      .where("status", "==", "accepted")
      .limit(1)
      .get(),
    col
      .where("fromUserId", "==", uidB)
      .where("toUserId", "==", uidA)
      .where("status", "==", "accepted")
      .limit(1)
      .get(),
  ]);

  return !fromA.empty || !fromB.empty;
}

/**
 * Janela de uma hora por remetente. Documento por hora, com o
 * próprio id carregando a janela — sem query e sem índice.
 */
async function checkRateLimit(uid: string): Promise<boolean> {
  const hourKey = new Date().toISOString().slice(0, 13); // AAAA-MM-DDTHH
  const ref = admin
    .firestore()
    .collection("pushRateLimit")
    .doc(`${uid}_${hourKey}`);

  try {
    const allowed = await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = (snap.data()?.count as number | undefined) ?? 0;

      if (count >= RATE_LIMIT_PER_HOUR) return false;

      tx.set(
        ref,
        {
          uid,
          count: count + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return true;
    });

    return allowed;
  } catch (error) {
    // Falha no controle não bloqueia push legítimo.
    console.warn("[sendUserPush] Rate limit indisponível:", error);
    return true;
  }
}

export const sendUserPush = onCall<SendUserPushPayload, Promise<SendUserPushResult>>(
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const senderUid: string = request.auth!.uid;

    const { targetUserId, event, chatId } = request.data ?? {};

    if (!targetUserId || typeof targetUserId !== "string") {
      throw new HttpsError("invalid-argument", "targetUserId obrigatório");
    }
    if (!event || !PUSH_EVENTS.includes(event)) {
      throw new HttpsError("invalid-argument", "event inválido");
    }
    if (targetUserId === senderUid) {
      throw new HttpsError("invalid-argument", "Não é possível notificar a si mesmo");
    }

    const db = admin.firestore();

    // Nome vem do SERVIDOR: aceitar do payload devolveria ao
    // cliente o poder de escrever o texto do push.
    const [senderSnap, targetSnap] = await Promise.all([
      db.collection("users").doc(senderUid).get(),
      db.collection("users").doc(targetUserId).get(),
    ]);

    if (!targetSnap.exists) {
      throw new HttpsError("not-found", "Destinatário não encontrado");
    }

    const senderData = senderSnap.data() ?? {};
    const targetData = targetSnap.data() ?? {};

    // Conta encerrada ou bloqueada não recebe push.
    if (targetData.accountBanned === true) {
      return { sent: false, reason: "TARGET_BANNED" };
    }

    const content = buildPushContent(
      event,
      typeof senderData.name === "string" ? senderData.name : "",
    );

    if (content.requiresConnection) {
      const connected = await areConnected(senderUid, targetUserId);
      if (!connected) {
        // Erro explícito, não silêncio: chamada sem conexão é
        // tentativa de abuso, não caso de uso.
        throw new HttpsError(
          "permission-denied",
          "É necessário ter uma conexão aceita para notificar este usuário",
        );
      }
    }

    // Bloqueio mútuo: quem bloqueou não recebe push de quem foi
    // bloqueado. Duas leituras, ids determinísticos.
    const blockA = await db.collection("blocks").doc(`${targetUserId}_${senderUid}`).get();
    if (blockA.exists) {
      return { sent: false, reason: "BLOCKED" };
    }

    const withinLimit = await checkRateLimit(senderUid);
    if (!withinLimit) {
      throw new HttpsError(
        "resource-exhausted",
        "Muitas notificações enviadas. Aguarde alguns minutos.",
      );
    }

    const token = await getPushToken(targetUserId);
    if (!token) {
      return { sent: false, reason: "NO_TOKEN" };
    }

    const data: Record<string, string> = { type: content.type };
    if (chatId && typeof chatId === "string") data.chatId = chatId;
    data.senderId = senderUid;
    if (typeof senderData.name === "string") data.senderName = senderData.name;
    if (typeof senderData.photoURL === "string") data.senderPhoto = senderData.photoURL;

    const result = await sendExpoPush(token, content.title, content.body, data);

    // Token morto: apagar evita tentar de novo para sempre.
    if (!result.sent && result.errorCode === "DeviceNotRegistered") {
      await deletePushToken(targetUserId);
      console.log(`[sendUserPush] Token morto removido: ${targetUserId}`);
    }

    if (!result.sent) {
      console.warn(`[sendUserPush] Não enviado (${result.errorCode}): ${senderUid} → ${targetUserId}`);
    }

    return { sent: result.sent, reason: result.errorCode };
  }
);
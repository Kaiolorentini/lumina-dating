// ============================================
// REPORT SCREENSHOT — DRM iOS
//
// Chamada pelo app quando usuário iOS tira print
// de conteúdo protegido.
//
// Fluxo:
// Print 1 → aviso de política (warned_1)
// Print 2 → última oportunidade (warned_2) + push admins
// Print 3 → aviso final (final) + push admins urgente
// Print 4 → conta sinalizada (flagged) + push admins crítico
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";

// UIDs dos superadmins que recebem notificações
// API_TODO #10: mover para appSettings/config no Firestore futuramente
const SUPERADMIN_UIDS = [
  "DOoEhA9B2QZfTnJrIBJIUhNjuC23", // kaio
];

async function getSuperAdminTokens(): Promise<string[]> {
  const tokens: string[] = [];
  for (const uid of SUPERADMIN_UIDS) {
    try {
      const snap = await admin.firestore().collection("users").doc(uid).get();
      const token = snap.data()?.pushToken;
      if (token) tokens.push(token);
    } catch {
      // continua mesmo sem token
    }
  }
  return tokens;
}

async function sendPushToAdmins(
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const tokens = await getSuperAdminTokens();
  if (!tokens.length) return;

  const messages = tokens.map(token => ({
    to: token,
    title,
    body,
    data: data ?? {},
    sound: "default",
    priority: "high",
  }));

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    console.warn("[reportScreenshot] Erro ao enviar push para admins:", error);
  }
}

export const reportScreenshot = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Não autenticado");
  const safeUid: string = uid;

  await assertUserNotBlocked(safeUid);

  const { productId } = request.data as { productId: string };
  if (!productId) throw new HttpsError("invalid-argument", "productId obrigatório");

  const db = admin.firestore();
  const userRef = db.collection("users").doc(safeUid);

  // Busca dados atuais do usuário
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError("not-found", "Usuário não encontrado");

  const userData = userSnap.data()!;
  const currentWarnings = userData.screenshotWarnings ?? 0;
  const newWarnings = currentWarnings + 1;
  const userName = userData.name ?? "Usuário desconhecido";

  // Define novo status
  type ScreenshotStatus = "clean" | "warned_1" | "warned_2" | "final" | "flagged";
  const statusMap: Record<number, ScreenshotStatus> = {
    1: "warned_1",
    2: "warned_2",
    3: "final",
    4: "flagged",
  };
  const newStatus: ScreenshotStatus = statusMap[newWarnings] ?? "flagged";

  // Atualiza contador no Firestore
  await userRef.update({
    screenshotWarnings: newWarnings,
    screenshotWarningStatus: newStatus,
    screenshotWarningProductId: productId,
    screenshotWarningAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Registra evento na collection screenshotEvents
  await db.collection("screenshotEvents").add({
    userId: safeUid,
    productId,
    warningNumber: newWarnings,
    platform: "ios",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Audit log sempre
  await createAuditLog({
    action: "screenshot_captured",
    performedBy: safeUid,
    targetId: productId,
    targetType: "product",
    metadata: {
      warningNumber: newWarnings,
      status: newStatus,
      productId,
    },
    req: request.rawRequest,
  });

  // Notificações para admins por nível
  if (newWarnings === 2) {
    await sendPushToAdmins(
      "⚠️ Print em conteúdo protegido",
      `${userName} tirou prints de conteúdo protegido (2x)`,
      { type: "screenshot_warning", userId: safeUid, productId, warningNumber: "2" }
    );
  }

  if (newWarnings === 3) {
    await sendPushToAdmins(
      "🔴 Limite de avisos atingido",
      `${userName} atingiu 3 prints — próximo resulta em banimento`,
      { type: "screenshot_warning", userId: safeUid, productId, warningNumber: "3" }
    );
  }

  if (newWarnings >= 4) {
    await sendPushToAdmins(
      "🚨 AÇÃO NECESSÁRIA",
      `${userName} tirou 4 prints de conteúdo protegido — confirmar banimento?`,
      { type: "screenshot_ban_required", userId: safeUid, productId, warningNumber: "4" }
    );
  }

  return {
    success: true,
    warningNumber: newWarnings,
    status: newStatus,
  };
});
// ============================================
// REPORT SCREENSHOT — DRM
//
// Chamada pelo app quando usuário tira print
// de conteúdo protegido.
//
// Fluxo:
// Print 1 → aviso de política (warned_1)
// Print 2 → última oportunidade (warned_2) + notifyAdmins
// Print 3 → aviso final (final) + notifyAdmins urgente
// Print 4 → conta sinalizada (flagged) + notifyAdmins crítico + fraudFlag piracy
//
// Push de admin centralizado em notifyAdmins (sem UID hardcoded).
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";
import { createFraudFlag } from "../utils/createFraudFlag";
import { notifyAdmins } from "../utils/notifyAdmins";

export const reportScreenshot = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Não autenticado");
  const safeUid: string = uid;

  await assertUserNotBlocked(safeUid);

  const { productId } = request.data as { productId: string };
  if (!productId) throw new HttpsError("invalid-argument", "productId obrigatório");

  const db = admin.firestore();
  const userRef = db.collection("users").doc(safeUid);

  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError("not-found", "Usuário não encontrado");

  const userData = userSnap.data()!;
  const currentWarnings = userData.screenshotWarnings ?? 0;
  const newWarnings = currentWarnings + 1;
  const userName = userData.name ?? "Usuário desconhecido";

  type ScreenshotStatus = "clean" | "warned_1" | "warned_2" | "final" | "flagged";
  const statusMap: Record<number, ScreenshotStatus> = {
    1: "warned_1",
    2: "warned_2",
    3: "final",
    4: "flagged",
  };
  const newStatus: ScreenshotStatus = statusMap[newWarnings] ?? "flagged";

  await userRef.update({
    screenshotWarnings: newWarnings,
    screenshotWarningStatus: newStatus,
    screenshotWarningProductId: productId,
    screenshotWarningAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection("screenshotEvents").add({
    userId: safeUid,
    productId,
    warningNumber: newWarnings,
    platform: "unknown",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await createAuditLog({
    action: "screenshot_captured",
    performedBy: safeUid,
    targetId: productId,
    targetType: "product",
    metadata: { warningNumber: newWarnings, status: newStatus, productId },
    req: request.rawRequest,
  });

  // Notificações para admins por nível — via notifyAdmins (fire-and-forget)
  if (newWarnings === 2) {
    notifyAdmins({
      title: "⚠️ Print em conteúdo protegido",
      body: `${userName} tirou prints de conteúdo protegido (2x)`,
      type: "screenshot_warning",
      data: { userId: safeUid, productId, warningNumber: "2" },
    }).catch(() => {});
  }

  if (newWarnings === 3) {
    notifyAdmins({
      title: "🔴 Limite de avisos atingido",
      body: `${userName} atingiu 3 prints — próximo resulta em banimento`,
      type: "screenshot_warning",
      data: { userId: safeUid, productId, warningNumber: "3" },
    }).catch(() => {});
  }

  if (newWarnings >= 4) {
    // Cria sinalização de fraude (piracy) — idempotente, fire-and-forget
    // (já notifica admins internamente via notifyAdmins)
    createFraudFlag({
      userId: safeUid,
      reason: "piracy",
      description: `${userName} tirou 4+ prints de conteúdo protegido`,
      relatedProductId: productId,
    }).catch((error) => {
      console.warn("[reportScreenshot] erro criando fraudFlag:", error);
    });
  }

  return {
    success: true,
    warningNumber: newWarnings,
    status: newStatus,
  };
});
// ============================================
// BAN USER AFTER SCREENSHOT — DRM iOS
// Requer SuperAdmin — dupla validação
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";

export const banUserAfterScreenshot = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const safeUid: string = request.auth!.uid;

  await assertSuperAdmin(safeUid);
  await assertUserNotBlocked(safeUid);

  const { userId, reason } = request.data as {
    userId: string;
    reason?: string;
  };

  if (!userId) throw new HttpsError("invalid-argument", "userId obrigatório");

  const db = admin.firestore();
  const targetRef = db.collection("users").doc(userId);
  const targetSnap = await targetRef.get();

  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "Usuário não encontrado");
  }

  const target = targetSnap.data()!;

  if ((target.screenshotWarnings ?? 0) < 4) {
    throw new HttpsError(
      "failed-precondition",
      "Usuário não atingiu o limite de prints para banimento"
    );
  }

  await targetRef.update({
    isBlocked: true,
    blockedReason: reason ?? "Violação repetida da política de proteção de conteúdo (4+ prints)",
    blockedAt: admin.firestore.FieldValue.serverTimestamp(),
    blockedBy: safeUid,
    screenshotWarningStatus: "flagged",
  });

  await createAuditLog({
    action: "user_banned_screenshot",
    performedBy: safeUid,
    targetId: userId,
    targetType: "user",
    metadata: {
      reason: reason ?? "4+ prints de conteúdo protegido",
      screenshotWarnings: target.screenshotWarnings,
      screenshotWarningProductId: target.screenshotWarningProductId,
    },
    req: request.rawRequest,
  });

  return { success: true };
});
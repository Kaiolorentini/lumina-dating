// ============================================
// RESOLVE FRAUD FLAG
//
// Atualiza o status de uma sinalização de fraude
// (fraudFlags/{flagId}) — exclusivo de SuperAdmin.
//
// Transições permitidas: reviewing | resolved | dismissed
// (nunca volta para 'open', nem aceita valor arbitrário)
//
// A coleção fraudFlags é allow write:false nas Rules —
// só o Admin SDK escreve. Auditado em auditLogs.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";

const ALLOWED_STATUS = ["reviewing", "resolved", "dismissed"] as const;
type AllowedStatus = typeof ALLOWED_STATUS[number];

export const resolveFraudFlag = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertSuperAdmin(uid);
  await assertUserNotBlocked(uid);

  const { flagId, newStatus, note } = request.data as {
    flagId?: string;
    newStatus?: string;
    note?: string;
  };

  if (!flagId) {
    throw new HttpsError("invalid-argument", "flagId obrigatório");
  }
  if (!newStatus || !ALLOWED_STATUS.includes(newStatus as AllowedStatus)) {
    throw new HttpsError(
      "invalid-argument",
      "newStatus deve ser reviewing, resolved ou dismissed"
    );
  }

  const flagRef = admin.firestore().collection("fraudFlags").doc(flagId);
  const flagSnap = await flagRef.get();

  if (!flagSnap.exists) {
    throw new HttpsError("not-found", "Sinalização não encontrada");
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedBy: uid,
  };
  if (typeof note === "string" && note.trim()) {
    updateData.reviewNote = note.trim();
  }

  await flagRef.update(updateData);

  await createAuditLog({
    action: "RESOLVE_FRAUD_FLAG",
    performedBy: uid,
    targetId: flagId,
    targetType: "fraudFlag",
    metadata: {
      newStatus,
      previousStatus: flagSnap.data()?.status,
      flaggedUserId: flagSnap.data()?.userId,
      note: note ?? null,
    },
    req: request.rawRequest,
  });

  return { success: true };
});
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";
import { notifyUser } from "../utils/notifyUser";

export const onRejectCreator = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertSuperAdmin(uid);
  await assertUserNotBlocked(uid);

  const { requestId, userId, reason } = request.data as {
    requestId: string;
    userId: string;
    reason?: string;
  };

  if (!requestId || !userId) {
    throw new HttpsError("invalid-argument", "requestId e userId são obrigatórios");
  }

  const requestRef = admin.firestore()
    .collection("creatorRequests").doc(requestId);
  const requestSnap = await requestRef.get();

  if (!requestSnap.exists) {
    throw new HttpsError("not-found", "Solicitação não encontrada");
  }
  if (requestSnap.data()?.status !== "pending") {
    throw new HttpsError("failed-precondition", "Solicitação já foi processada");
  }

  await requestRef.update({
    status: "rejected",
    rejectionReason: reason ?? "Solicitação rejeitada pelo administrador",
    reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedBy: uid,
  });

  await createAuditLog({
    action: "creator_rejected",
    performedBy: uid,
    targetId: requestId,
    targetType: "creator",
    metadata: { userId, reason },
    req: request.rawRequest,
  });

  // ✅ Notifica o usuário rejeitado — push + in-app
  await notifyUser({
    userId,
    title: "❌ Solicitação rejeitada",
    body: reason
      ? `Sua solicitação foi rejeitada. Motivo: ${reason}`
      : "Sua solicitação de criador foi rejeitada pelo administrador.",
    type: "creator_rejected",
    data: { requestId },
  });

  return { success: true };
});
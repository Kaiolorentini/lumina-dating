import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";
import { incrementMetric } from "../utils/incrementMetric";

export const onApproveCreator = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertSuperAdmin(uid);
  await assertUserNotBlocked(uid);

  const { requestId, userId } = request.data as {
    requestId: string;
    userId: string;
  };

  if (!requestId || !userId) {
    throw new HttpsError("invalid-argument", "requestId e userId são obrigatórios");
  }

  const db = admin.firestore();

  await db.runTransaction(async (tx) => {
    const requestRef = db.collection("creatorRequests").doc(requestId);
    const userRef = db.collection("users").doc(userId);

    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists) {
      throw new HttpsError("not-found", "Solicitação não encontrada");
    }
    if (requestSnap.data()?.status !== "pending") {
      throw new HttpsError("failed-precondition", "Solicitação já foi processada");
    }

    tx.update(requestRef, {
      status: "approved",
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: uid,
    });

    tx.update(userRef, { role: "creator" });
  });

  await incrementMetric("totalCreators");

  await createAuditLog({
    action: "creator_approved",
    performedBy: uid,
    targetId: requestId,
    targetType: "creator",
    metadata: { userId },
    req: request.rawRequest,
  });

  return { success: true };
});
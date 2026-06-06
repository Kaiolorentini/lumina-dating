import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";

export const rejectRefund = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertSuperAdmin(uid);
  await assertUserNotBlocked(uid);

  const { refundRequestId, reason } = request.data as {
    refundRequestId: string;
    reason?: string;
  };

  if (!refundRequestId) {
    throw new HttpsError("invalid-argument", "refundRequestId obrigatório");
  }

  const db = admin.firestore();
  const refundRef = db.collection("refundRequests").doc(refundRequestId);

  await db.runTransaction(async (tx) => {
    const refundSnap = await tx.get(refundRef);
    if (!refundSnap.exists) {
      throw new HttpsError("not-found", "Solicitação de reembolso não encontrada");
    }
    const refund = refundSnap.data()!;
    if (refund.status !== "pending") {
      throw new HttpsError("failed-precondition", "Solicitação já foi processada");
    }

    const saleRef = db.collection("sales").doc(refund.saleId);

    tx.update(refundRef, {
      status: "rejected",
      rejectionReason: reason ?? "Reembolso não aprovado",
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: uid,
    });

    tx.update(saleRef, {
      status: "paid",
      refundRequestedAt: admin.firestore.FieldValue.delete(),
    });
  });

  const refundSnap = await refundRef.get();

  await createAuditLog({
    action: "refund_rejected",
    performedBy: uid,
    targetId: refundRequestId,
    targetType: "sale",
    metadata: {
      saleId: refundSnap.data()?.saleId,
      reason,
    },
    req: request.rawRequest,
  });

  return { success: true };
});
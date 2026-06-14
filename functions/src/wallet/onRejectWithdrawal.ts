import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { createAuditLog } from "../utils/auditLog";
import { notifyUser } from "../utils/notifyUser";

export const onRejectWithdrawal = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const safeUid: string = request.auth!.uid;

  await assertSuperAdmin(safeUid);

  const { withdrawalId, reason } = request.data as {
    withdrawalId: string;
    reason?: string;
  };
  if (!withdrawalId) throw new HttpsError("invalid-argument", "withdrawalId obrigatório");

  const db = admin.firestore();
  const withdrawalRef = db.collection("withdrawals").doc(withdrawalId);
  const snap = await withdrawalRef.get();

  if (!snap.exists) throw new HttpsError("not-found", "Saque não encontrado");
  if (!["pending", "approved"].includes(snap.data()?.status)) {
    throw new HttpsError("failed-precondition", "Saque não pode ser rejeitado neste estado");
  }

  const { userId, amount } = snap.data()!;

  await withdrawalRef.update({
    status: "rejected",
    rejectionReason: reason ?? "Rejeitado pelo administrador",
    reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedBy: safeUid,
  });

  await createAuditLog({
    action: "withdrawal_rejected",
    performedBy: safeUid,
    targetId: withdrawalId,
    targetType: "withdrawal",
    metadata: { reason, userId, amount },
    req: request.rawRequest,
  });

  // ✅ Notifica o criador — push + in-app
  if (userId) {
    await notifyUser({
      userId,
      title: "❌ Saque rejeitado",
      body: reason
        ? `Seu saque de R$ ${amount?.toFixed(2)} foi rejeitado. Motivo: ${reason}`
        : `Seu saque de R$ ${amount?.toFixed(2)} foi rejeitado pelo administrador.`,
      type: "withdrawal_rejected",
      data: { withdrawalId },
    });
  }

  return { success: true };
});
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { createAuditLog } from "../utils/auditLog";

export const onApproveWithdrawal = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const safeUid: string = request.auth!.uid;

  await assertSuperAdmin(safeUid);

  const { withdrawalId } = request.data as { withdrawalId: string };
  if (!withdrawalId) throw new HttpsError("invalid-argument", "withdrawalId obrigatório");

  const db = admin.firestore();
  const withdrawalRef = db.collection("withdrawals").doc(withdrawalId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(withdrawalRef);
    if (!snap.exists) throw new HttpsError("not-found", "Saque não encontrado");

    const data = snap.data()!;
    if (data.status !== "pending") {
      throw new HttpsError("failed-precondition", "Saque não está pendente");
    }

    const walletRef = db.collection("creatorWallets").doc(data.userId);
    const walletSnap = await tx.get(walletRef);
    const wallet = walletSnap.data();

    if (!wallet || wallet.availableBalance < data.amount) {
      throw new HttpsError("failed-precondition", "Saldo insuficiente");
    }

    if (wallet.hasChargebackPending) {
      throw new HttpsError("failed-precondition", "Saque bloqueado por chargeback pendente");
    }

    tx.update(withdrawalRef, {
      status: "approved",
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: safeUid,
    });
  });

  const snap = await withdrawalRef.get();
  await createAuditLog({
    action: "withdrawal_approved",
    performedBy: safeUid,
    targetId: withdrawalId,
    targetType: "withdrawal",
    metadata: {
      userId: snap.data()?.userId,
      amount: snap.data()?.amount,
    },
    req: request.rawRequest,
  });

  return { success: true };
});
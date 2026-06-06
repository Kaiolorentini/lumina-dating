import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { createAuditLog } from "../utils/auditLog";
import { incrementMetric } from "../utils/incrementMetric";

export const onMarkWithdrawalPaid = onCall(async (request) => {
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
    if (data.status !== "approved") {
      throw new HttpsError("failed-precondition", "Saque precisa estar aprovado antes de marcar como pago");
    }

    const walletRef = db.collection("creatorWallets").doc(data.userId);
    const walletSnap = await tx.get(walletRef);
    const wallet = walletSnap.data();

    if (!wallet || wallet.availableBalance < data.amount) {
      throw new HttpsError("failed-precondition", "Saldo insuficiente para processar pagamento");
    }

    tx.update(walletRef, {
      availableBalance: admin.firestore.FieldValue.increment(-data.amount),
      totalWithdrawn: admin.firestore.FieldValue.increment(data.amount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.update(withdrawalRef, {
      status: "paid",
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      processedBy: safeUid,
    });

    const txRef = db.collection("creatorTransactions").doc();
    tx.set(txRef, {
      userId: data.userId,
      type: "withdrawal",
      amount: -data.amount,
      description: `Saque pago via Pix`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  const snap = await withdrawalRef.get();
  await incrementMetric("totalWithdrawn", snap.data()?.amount ?? 0);

  await createAuditLog({
    action: "withdrawal_paid",
    performedBy: safeUid,
    targetId: withdrawalId,
    targetType: "withdrawal",
    metadata: { userId: snap.data()?.userId, amount: snap.data()?.amount },
    req: request.rawRequest,
  });

  return { success: true };
});
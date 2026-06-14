import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { createAuditLog } from "../utils/auditLog";
import { incrementMetric } from "../utils/incrementMetric";
import { notifyUser } from "../utils/notifyUser";

export const onMarkWithdrawalPaid = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const safeUid: string = request.auth!.uid;

  await assertSuperAdmin(safeUid);

  const { withdrawalId } = request.data as { withdrawalId: string };
  if (!withdrawalId) throw new HttpsError("invalid-argument", "withdrawalId obrigatório");

  const db = admin.firestore();
  const withdrawalRef = db.collection("withdrawals").doc(withdrawalId);

  let userId = "";
  let amount = 0;

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

    userId = data.userId;
    amount = data.amount;

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
      description: "Saque pago via Pix",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await incrementMetric("totalWithdrawn", amount);

  await createAuditLog({
    action: "withdrawal_paid",
    performedBy: safeUid,
    targetId: withdrawalId,
    targetType: "withdrawal",
    metadata: { userId, amount },
    req: request.rawRequest,
  });

  // ✅ Notifica o criador — push + in-app
  if (userId) {
    await notifyUser({
      userId,
      title: "💰 Saque pago!",
      body: `R$ ${amount.toFixed(2)} foi transferido para sua chave Pix.`,
      type: "withdrawal_paid",
      data: { withdrawalId },
    });
  }

  return { success: true };
});
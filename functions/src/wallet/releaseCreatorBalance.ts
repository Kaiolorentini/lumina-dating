import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";

export const releaseCreatorBalance = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Não autenticado");

  await assertUserNotBlocked(uid);

  // Apenas admin ou superadmin libera saldo manualmente no MVP
  const adminSnap = await admin.firestore().collection("users").doc(uid).get();
  const role = adminSnap.data()?.role;
  if (!["admin", "superadmin"].includes(role)) {
    throw new HttpsError("permission-denied", "Apenas admins podem liberar saldo");
  }

  const { creatorId } = request.data as { creatorId: string };
  if (!creatorId) throw new HttpsError("invalid-argument", "creatorId obrigatório");

  const db = admin.firestore();
  const walletRef = db.collection("creatorWallets").doc(creatorId);

  let releasedAmount = 0;

  await db.runTransaction(async (tx) => {
    const walletSnap = await tx.get(walletRef);
    if (!walletSnap.exists) {
      throw new HttpsError("not-found", "Wallet não encontrada");
    }

    const wallet = walletSnap.data()!;
    const pendingBalance = wallet.pendingBalance ?? 0;

    // Proteção: não libera se não há saldo pendente
    if (pendingBalance <= 0) {
      throw new HttpsError("failed-precondition", "Não há saldo pendente para liberar");
    }

    releasedAmount = pendingBalance;

    tx.update(walletRef, {
      availableBalance: admin.firestore.FieldValue.increment(pendingBalance),
      pendingBalance: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Registra transaction de liberação
    const txRef = db.collection("creatorTransactions").doc();
    tx.set(txRef, {
      userId: creatorId,
      type: "commission",
      amount: pendingBalance,
      description: "Saldo liberado pelo administrador",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await createAuditLog({
    action: "balance_released",
    performedBy: uid,
    targetId: creatorId,
    targetType: "creator",
    metadata: { releasedAmount },
    req: request.rawRequest,
  });

  return { success: true, releasedAmount };
});
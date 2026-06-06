import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { createAuditLog } from "../utils/auditLog";

export const blockUser = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const safeUid: string = request.auth!.uid;

  await assertSuperAdmin(safeUid);

  const { userId, reason } = request.data as {
    userId: string;
    reason?: string;
  };
  if (!userId) throw new HttpsError("invalid-argument", "userId obrigatório");
  if (userId === safeUid) throw new HttpsError("invalid-argument", "Não é possível bloquear a si mesmo");

  const userRef = admin.firestore().collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError("not-found", "Usuário não encontrado");

  const oldRole = userSnap.data()?.role;

  await userRef.update({
    isBlocked: true,
    blockedReason: reason ?? "Bloqueado pelo administrador",
    blockedAt: admin.firestore.FieldValue.serverTimestamp(),
    blockedBy: safeUid,
  });

  await createAuditLog({
    action: "user_blocked",
    performedBy: safeUid,
    targetId: userId,
    targetType: "user",
    metadata: { reason, oldRole, userName: userSnap.data()?.name },
    req: request.rawRequest,
  });

  return { success: true };
});
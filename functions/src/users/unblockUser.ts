import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { createAuditLog } from "../utils/auditLog";

export const unblockUser = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const safeUid: string = request.auth!.uid;

  await assertSuperAdmin(safeUid);

  const { userId } = request.data as { userId: string };
  if (!userId) throw new HttpsError("invalid-argument", "userId obrigatório");

  const userRef = admin.firestore().collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError("not-found", "Usuário não encontrado");

  await userRef.update({
    isBlocked: false,
    blockedReason: admin.firestore.FieldValue.delete(),
    blockedAt: admin.firestore.FieldValue.delete(),
    blockedBy: admin.firestore.FieldValue.delete(),
  });

  await createAuditLog({
    action: "user_unblocked",
    performedBy: safeUid,
    targetId: userId,
    targetType: "user",
    metadata: { userName: userSnap.data()?.name },
    req: request.rawRequest,
  });

  return { success: true };
});
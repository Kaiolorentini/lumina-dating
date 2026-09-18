import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { createAuditLog } from "../utils/auditLog";
import { notifyUser } from "../utils/notifyUser";

export const unblockUser = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const safeUid: string = request.auth!.uid;

  await assertSuperAdmin(safeUid);

  const { userId } = request.data as { userId: string };
  if (!userId) throw new HttpsError("invalid-argument", "userId obrigatório");

  const userRef = admin.firestore().collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError("not-found", "Usuário não encontrado");

  const userData = userSnap.data() ?? {};

  const patch: Record<string, unknown> = {
    isBlocked: false,
    blockedReason: admin.firestore.FieldValue.delete(),
    blockedAt: admin.firestore.FieldValue.delete(),
    blockedBy: admin.firestore.FieldValue.delete(),
    blockedSource: admin.firestore.FieldValue.delete(),
    marketplaceBanUntil: admin.firestore.FieldValue.delete(),
    previousRole: admin.firestore.FieldValue.delete(),
  };

  // Devolve o papel rebaixado pela punição. O previousRole é
  // lido e aplicado NO MESMO patch que o apaga — apagar antes
  // perderia o papel de criador.
  const previousRole = userData.previousRole;
  const restoredRole =
    typeof previousRole === "string" && previousRole !== "user" ? previousRole : null;
  if (restoredRole) {
    patch.role = restoredRole;
  }

  await userRef.update(patch);

  await createAuditLog({
    action: "user_unblocked",
    performedBy: safeUid,
    targetId: userId,
    targetType: "user",
    metadata: { userName: userData.name, restoredRole },
    req: request.rawRequest,
  });

  await notifyUser({
    userId,
    title: "✅ Acesso liberado",
    body: restoredRole
      ? "Seu acesso ao Marketplace e suas ferramentas de criador foram restaurados."
      : "Seu acesso ao Marketplace foi restaurado.",
    type: "marketplace_unbanned",
  });

  return { success: true, restoredRole };
});
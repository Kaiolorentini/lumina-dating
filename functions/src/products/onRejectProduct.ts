import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";
import { notifyUser } from "../utils/notifyUser";

export const onRejectProduct = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertSuperAdmin(uid);
  await assertUserNotBlocked(uid);

  const { productId, reason } = request.data as {
    productId: string;
    reason?: string;
  };
  if (!productId) throw new HttpsError("invalid-argument", "productId obrigatório");

  const productRef = admin.firestore().collection("products").doc(productId);
  const productSnap = await productRef.get();

  if (!productSnap.exists) {
    throw new HttpsError("not-found", "Produto não encontrado");
  }
  if (!["pending", "approved"].includes(productSnap.data()?.status)) {
    throw new HttpsError("failed-precondition", "Produto não pode ser rejeitado neste estado");
  }

  const ownerId = productSnap.data()!.ownerId;
  const productTitle = productSnap.data()!.title ?? "seu produto";

  await productRef.update({
    status: "rejected",
    rejectionReason: reason ?? "Produto rejeitado pelo administrador",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await createAuditLog({
    action: "product_rejected",
    performedBy: uid,
    targetId: productId,
    targetType: "product",
    metadata: { reason, ownerId },
    req: request.rawRequest,
  });

  // ✅ Notifica o criador — push + in-app
  if (ownerId) {
    await notifyUser({
      userId: ownerId,
      title: "❌ Produto rejeitado",
      body: reason
        ? `"${productTitle}" foi rejeitado. Motivo: ${reason}`
        : `"${productTitle}" foi rejeitado pelo administrador.`,
      type: "product_rejected",
      data: { productId },
    });
  }

  return { success: true };
});
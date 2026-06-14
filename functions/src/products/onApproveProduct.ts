import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";
import { incrementMetric } from "../utils/incrementMetric";
import { notifyUser } from "../utils/notifyUser";

export const onApproveProduct = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertSuperAdmin(uid);
  await assertUserNotBlocked(uid);

  const { productId } = request.data as { productId: string };
  if (!productId) throw new HttpsError("invalid-argument", "productId obrigatório");

  const db = admin.firestore();
  const productRef = db.collection("products").doc(productId);

  let ownerId = "";

  await db.runTransaction(async (tx) => {
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists) {
      throw new HttpsError("not-found", "Produto não encontrado");
    }
    if (productSnap.data()?.status !== "pending") {
      throw new HttpsError("failed-precondition", "Produto não está pendente de aprovação");
    }

    ownerId = productSnap.data()!.ownerId;

    tx.update(productRef, {
      status: "approved",
      version: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await incrementMetric("totalProducts");

  await createAuditLog({
    action: "product_approved",
    performedBy: uid,
    targetId: productId,
    targetType: "product",
    metadata: { ownerId },
    req: request.rawRequest,
  });

  // ✅ Notifica o criador — push + in-app
  if (ownerId) {
    await notifyUser({
      userId: ownerId,
      title: "✅ Produto aprovado!",
      body: "Seu produto foi aprovado e já está disponível no marketplace.",
      type: "product_approved",
      data: { productId },
    });
  }

  return { success: true };
});
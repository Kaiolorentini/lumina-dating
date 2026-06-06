import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";
import { incrementMetric } from "../utils/incrementMetric";

export const onApproveProduct = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertSuperAdmin(uid);
  await assertUserNotBlocked(uid);

  const { productId } = request.data as { productId: string };
  if (!productId) throw new HttpsError("invalid-argument", "productId obrigatório");

  const db = admin.firestore();
  const productRef = db.collection("products").doc(productId);

  await db.runTransaction(async (tx) => {
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists) {
      throw new HttpsError("not-found", "Produto não encontrado");
    }
    if (productSnap.data()?.status !== "pending") {
      throw new HttpsError("failed-precondition", "Produto não está pendente de aprovação");
    }

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
    metadata: {},
    req: request.rawRequest,
  });

  return { success: true };
});
// ============================================
// TOGGLE COUPON — SuperAdmin
//
// Ativa ou desativa um cupom (isActive).
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../../utils/adminGuard";
import { assertUserNotBlocked } from "../../utils/assertUserNotBlocked";
import { createAuditLog } from "../../utils/auditLog";

export const toggleCoupon = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertSuperAdmin(uid);
  await assertUserNotBlocked(uid);

  const { couponId, isActive } = request.data as {
    couponId?: string;
    isActive?: boolean;
  };

  if (!couponId) throw new HttpsError("invalid-argument", "couponId obrigatório");
  if (typeof isActive !== "boolean") {
    throw new HttpsError("invalid-argument", "isActive deve ser boolean");
  }

  const db = admin.firestore();
  const ref = db.collection("coupons").doc(couponId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Cupom não encontrado");

  await ref.update({
    isActive,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await createAuditLog({
    action: "coupon_status_changed",
    performedBy: uid,
    targetId: couponId,
    targetType: "coupon",
    metadata: { isActive, code: snap.data()?.code },
    req: request.rawRequest,
  });

  return { success: true };
});
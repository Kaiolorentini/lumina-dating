// ============================================
// UPDATE COUPON — SuperAdmin
//
// Edita desconto, datas, limite e valor mínimo.
// NUNCA altera: code, usedCount, createdBy, createdAt.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../../utils/adminGuard";
import { assertUserNotBlocked } from "../../utils/assertUserNotBlocked";
import { createAuditLog } from "../../utils/auditLog";

type DiscountType = "percentage" | "fixed";

export const updateCoupon = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertSuperAdmin(uid);
  await assertUserNotBlocked(uid);

  const {
    couponId, discountType, discountValue,
    startDate, expiresAt, maxUses, minimumPurchaseAmount,
  } = request.data as {
    couponId?: string;
    discountType?: DiscountType;
    discountValue?: number;
    startDate?: number;
    expiresAt?: number;
    maxUses?: number;
    minimumPurchaseAmount?: number;
  };

  if (!couponId) throw new HttpsError("invalid-argument", "couponId obrigatório");

  const db = admin.firestore();
  const ref = db.collection("coupons").doc(couponId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Cupom não encontrado");

  // Monta update apenas com campos permitidos e enviados
  const update: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (discountType !== undefined) {
    if (discountType !== "percentage" && discountType !== "fixed") {
      throw new HttpsError("invalid-argument", "discountType inválido");
    }
    update.discountType = discountType;
  }

  if (discountValue !== undefined) {
    if (typeof discountValue !== "number" || discountValue <= 0) {
      throw new HttpsError("invalid-argument", "discountValue deve ser maior que zero");
    }
    const effectiveType = discountType ?? snap.data()?.discountType;
    if (effectiveType === "percentage" && discountValue > 100) {
      throw new HttpsError("invalid-argument", "Desconto percentual não pode passar de 100%");
    }
    update.discountValue = discountValue;
  }

  // Datas — valida coerência com o que ficará no documento
  const finalStart = startDate ?? (snap.data()?.startDate?.toMillis?.() ?? null);
  const finalEnd = expiresAt ?? (snap.data()?.expiresAt?.toMillis?.() ?? null);
  if (startDate !== undefined || expiresAt !== undefined) {
    if (finalStart !== null && finalEnd !== null && finalStart >= finalEnd) {
      throw new HttpsError("invalid-argument", "Data inicial deve ser antes da final");
    }
    if (startDate !== undefined) {
      update.startDate = admin.firestore.Timestamp.fromMillis(startDate);
    }
    if (expiresAt !== undefined) {
      update.expiresAt = admin.firestore.Timestamp.fromMillis(expiresAt);
    }
  }

  if (maxUses !== undefined) {
    if (typeof maxUses !== "number" || maxUses < 0) {
      throw new HttpsError("invalid-argument", "maxUses inválido");
    }
    update.maxUses = Math.floor(maxUses);
  }

  if (minimumPurchaseAmount !== undefined) {
    if (typeof minimumPurchaseAmount !== "number" || minimumPurchaseAmount < 0) {
      throw new HttpsError("invalid-argument", "minimumPurchaseAmount inválido");
    }
    update.minimumPurchaseAmount = minimumPurchaseAmount;
  }

  await ref.update(update);

  await createAuditLog({
    action: "coupon_updated",
    performedBy: uid,
    targetId: couponId,
    targetType: "coupon",
    metadata: { changedFields: Object.keys(update).filter(k => k !== "updatedAt") },
    req: request.rawRequest,
  });

  return { success: true };
});
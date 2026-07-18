// ============================================
// CREATE COUPON — SuperAdmin
//
// Cria um cupom em coupons/{autoId}. Código único
// validado por query (não é o id do doc).
// maxUses = 0 significa ilimitado.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../../utils/adminGuard";
import { assertUserNotBlocked } from "../../utils/assertUserNotBlocked";
import { createAuditLog } from "../../utils/auditLog";

type DiscountType = "percentage" | "fixed";

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export const createCoupon = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertSuperAdmin(uid);
  await assertUserNotBlocked(uid);

  const {
    code, discountType, discountValue,
    startDate, expiresAt, maxUses, minimumPurchaseAmount,
  } = request.data as {
    code?: string;
    discountType?: DiscountType;
    discountValue?: number;
    startDate?: number;            // epoch ms
    expiresAt?: number;            // epoch ms
    maxUses?: number;
    minimumPurchaseAmount?: number;
  };

  // ---- Validações ----
  if (!code || !code.trim()) {
    throw new HttpsError("invalid-argument", "Código obrigatório");
  }
  const normalizedCode = normalizeCode(code);
  if (normalizedCode.length < 3) {
    throw new HttpsError("invalid-argument", "Código deve ter ao menos 3 caracteres");
  }

  if (discountType !== "percentage" && discountType !== "fixed") {
    throw new HttpsError("invalid-argument", "discountType inválido");
  }
  if (typeof discountValue !== "number" || discountValue <= 0) {
    throw new HttpsError("invalid-argument", "discountValue deve ser maior que zero");
  }
  if (discountType === "percentage" && discountValue > 100) {
    throw new HttpsError("invalid-argument", "Desconto percentual não pode passar de 100%");
  }

  if (typeof startDate !== "number" || typeof expiresAt !== "number") {
    throw new HttpsError("invalid-argument", "Datas obrigatórias");
  }
  if (startDate >= expiresAt) {
    throw new HttpsError("invalid-argument", "Data inicial deve ser antes da final");
  }

  const safeMaxUses = typeof maxUses === "number" && maxUses >= 0 ? Math.floor(maxUses) : 0;
  const safeMinPurchase =
    typeof minimumPurchaseAmount === "number" && minimumPurchaseAmount > 0
      ? minimumPurchaseAmount
      : 0;

  const db = admin.firestore();

  // ---- Código duplicado? (índice lógico por query) ----
  const existing = await db.collection("coupons")
    .where("code", "==", normalizedCode)
    .limit(1)
    .get();

  if (!existing.empty) {
    throw new HttpsError("already-exists", `Já existe um cupom com o código ${normalizedCode}`);
  }

  // ---- Cria ----
  const ref = await db.collection("coupons").add({
    code: normalizedCode,
    discountType,
    discountValue,
    startDate: admin.firestore.Timestamp.fromMillis(startDate),
    expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt),
    maxUses: safeMaxUses,
    usedCount: 0,
    minimumPurchaseAmount: safeMinPurchase,
    isActive: true,
    createdBy: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await createAuditLog({
    action: "coupon_created",
    performedBy: uid,
    targetId: ref.id,
    targetType: "coupon",
    metadata: { code: normalizedCode, discountType, discountValue, maxUses: safeMaxUses },
    req: request.rawRequest,
  });

  return { success: true, couponId: ref.id, code: normalizedCode };
});
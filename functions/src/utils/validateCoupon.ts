// ============================================
// VALIDATE COUPON — helper (preparado para Fase 3)
//
// NÃO é chamado pelo checkout ainda. Criado e testável.
// Valida: existe, ativo, dentro de startDate..expiresAt,
// dentro do limite de uso (maxUses=0 = ilimitado),
// e purchaseAmount >= minimumPurchaseAmount.
//
// Retorna o desconto calculado — NUNCA confie no cliente
// para calcular desconto; use este helper no backend.
// ============================================

import * as admin from "firebase-admin";

export interface ValidateCouponResult {
  valid: boolean;
  reason?: string;
  couponId?: string;
  code?: string;
  discountAmount: number;
  finalAmount: number;
}

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return null;
}

export async function validateCoupon(
  rawCode: string,
  purchaseAmount: number
): Promise<ValidateCouponResult> {
  const fail = (reason: string): ValidateCouponResult => ({
    valid: false,
    reason,
    discountAmount: 0,
    finalAmount: purchaseAmount,
  });

  if (!rawCode || !rawCode.trim()) return fail("Código não informado");
  if (typeof purchaseAmount !== "number" || purchaseAmount <= 0) {
    return fail("Valor de compra inválido");
  }

  const code = rawCode.trim().toUpperCase().replace(/\s+/g, "");
  const db = admin.firestore();

  const snap = await db.collection("coupons")
    .where("code", "==", code)
    .limit(1)
    .get();

  if (snap.empty) return fail("Cupom não encontrado");

  const doc = snap.docs[0];
  const c = doc.data();

  if (c.isActive !== true) return fail("Cupom inativo");

  const now = Date.now();
  const start = toMillis(c.startDate);
  const end = toMillis(c.expiresAt);
  if (start !== null && now < start) return fail("Cupom ainda não está válido");
  if (end !== null && now > end) return fail("Cupom expirado");

  // maxUses = 0 → ilimitado
  const maxUses = typeof c.maxUses === "number" ? c.maxUses : 0;
  const usedCount = typeof c.usedCount === "number" ? c.usedCount : 0;
  if (maxUses > 0 && usedCount >= maxUses) return fail("Cupom esgotado");

  const minPurchase = typeof c.minimumPurchaseAmount === "number" ? c.minimumPurchaseAmount : 0;
  if (minPurchase > 0 && purchaseAmount < minPurchase) {
    return fail(`Valor mínimo de R$ ${minPurchase.toFixed(2)} não atingido`);
  }

  // Calcula desconto
  let discountAmount = 0;
  if (c.discountType === "percentage") {
    discountAmount = (purchaseAmount * c.discountValue) / 100;
  } else {
    discountAmount = c.discountValue;
  }

  // Nunca desconta mais que o valor da compra
  if (discountAmount > purchaseAmount) discountAmount = purchaseAmount;
  discountAmount = Math.round(discountAmount * 100) / 100;

  const finalAmount = Math.round((purchaseAmount - discountAmount) * 100) / 100;

  return {
    valid: true,
    couponId: doc.id,
    code,
    discountAmount,
    finalAmount,
  };
}
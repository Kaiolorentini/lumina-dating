// ============================================
// BUILD PURCHASE PRICING — motor de precificação do checkout
//
// (Antes chamado validateCoupon — renomeado porque virou
//  o motor de pricing da compra, não só um validador.)
//
// Aceita couponCode OPCIONAL e SEMPRE retorna a mesma
// estrutura de pricing (com ou sem cupom). Isso deixa o
// createAsaasPayment linear, sem ramificações if/else.
//
// - Sem cupom  → hasCoupon:false, discount 0, finalAmount = preço
// - Com cupom válido → aplica desconto, retorna dados congeláveis
// - Com cupom inválido → { valid:false, reason }
//
// É a ÚNICA fonte da regra de desconto. Nunca duplicar a
// fórmula fora daqui. Futuras regras (categoria, primeira
// compra, premium, cashback, sazonais) entram AQUI.
// ============================================

import * as admin from "firebase-admin";

export type CouponDiscountType = "percentage" | "fixed";

export interface PurchasePricing {
  valid: boolean;
  reason?: string;

  hasCoupon: boolean;
  couponId: string | null;
  couponCode: string | null;
  couponType: CouponDiscountType | null;
  couponValue: number | null;
  discountPercentage: number | null;   // % quando percentual; null quando fixo/sem cupom

  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
}

interface BuildPurchasePricingInput {
  couponCode?: string | null;
  amount: number;                // preço do produto (product.price)
}

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function buildPurchasePricing(
  input: BuildPurchasePricingInput
): Promise<PurchasePricing> {
  const rawAmount = input.amount;
  const couponCode = input.couponCode;

  // Normaliza o valor de entrada (evita imprecisão vinda do Firestore/Asaas)
  const amount = round2(rawAmount);

  // Base: pricing sem cupom (default sempre válido)
  const base: PurchasePricing = {
    valid: true,
    hasCoupon: false,
    couponId: null,
    couponCode: null,
    couponType: null,
    couponValue: null,
    discountPercentage: null,
    originalAmount: amount,
    discountAmount: 0,
    finalAmount: amount,
  };

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ...base, valid: false, reason: "Valor de compra inválido" };
  }

  // Sem código → retorna base (sem cupom)
  if (!couponCode || !couponCode.trim()) {
    return base;
  }

  const code = couponCode.trim().toUpperCase().replace(/\s+/g, "");
  const db = admin.firestore();

  const snap = await db.collection("coupons")
    .where("code", "==", code)
    .limit(1)
    .get();

  if (snap.empty) {
    return { ...base, valid: false, reason: "Cupom não encontrado" };
  }

  const docSnap = snap.docs[0];
  const c = docSnap.data();

  if (c.isActive !== true) {
    return { ...base, valid: false, reason: "Este cupom está inativo" };
  }

  const now = Date.now();
  const start = toMillis(c.startDate);
  const end = toMillis(c.expiresAt);
  if (start !== null && now < start) {
    return { ...base, valid: false, reason: "Este cupom ainda não está válido" };
  }
  if (end !== null && now > end) {
    return { ...base, valid: false, reason: "Este cupom expirou" };
  }

  // maxUses = 0 → ilimitado
  const maxUses = typeof c.maxUses === "number" ? c.maxUses : 0;
  const usedCount = typeof c.usedCount === "number" ? c.usedCount : 0;
  if (maxUses > 0 && usedCount >= maxUses) {
    return { ...base, valid: false, reason: "Este cupom atingiu o limite de usos" };
  }

  const minPurchase = typeof c.minimumPurchaseAmount === "number" ? c.minimumPurchaseAmount : 0;
  if (minPurchase > 0 && amount < minPurchase) {
    return {
      ...base,
      valid: false,
      reason: `Valor mínimo de R$ ${minPurchase.toFixed(2)} não atingido`,
    };
  }

  const couponType: CouponDiscountType = c.discountType === "fixed" ? "fixed" : "percentage";
  const couponValue: number = typeof c.discountValue === "number" ? c.discountValue : 0;

  // Validação defensiva do valor cadastrado (evita dados corrompidos)
  if (!Number.isFinite(couponValue) || couponValue <= 0) {
    return { ...base, valid: false, reason: "Cupom com valor inválido" };
  }
  if (couponType === "percentage" && couponValue > 100) {
    return { ...base, valid: false, reason: "Cupom com percentual inválido" };
  }

  // Calcula desconto (fonte única da fórmula)
  let discountAmount = 0;
  if (couponType === "percentage") {
    discountAmount = (amount * couponValue) / 100;
  } else {
    discountAmount = couponValue;
  }

  // Nunca desconta mais que o valor da compra
  if (discountAmount > amount) discountAmount = amount;
  discountAmount = round2(discountAmount);

  const finalAmount = round2(Math.max(0, amount - discountAmount));
  const discountPercentage = couponType === "percentage" ? couponValue : null;

  return {
    valid: true,
    hasCoupon: true,
    couponId: docSnap.id,
    couponCode: code,
    couponType,
    couponValue,
    discountPercentage,
    originalAmount: amount,
    discountAmount,
    finalAmount,
  };
}
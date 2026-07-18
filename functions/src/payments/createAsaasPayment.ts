// ============================================
// CREATE ASAAS PAYMENT — FASE 6B
//
// Cria cobrança Pix no Asaas com idempotência
// completa via runTransaction().
// pixQrCode retornado na response apenas —
// nunca salvo no Firestore.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { calculateCommission } from "../utils/calculateCommission";
import { buildPurchasePricing } from "../utils/buildPurchasePricing";
import { createAuditLog } from "../utils/auditLog";
import {
  findOrCreateCustomer,
  createPixPayment,
  formatDueDate,
} from "../utils/asaasClient";

export const createAsaasPayment = onCall(
  {
    secrets: ["ASAAS_API_KEY", "ASAAS_ENVIRONMENT"],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Não autenticado");

    await assertUserNotBlocked(uid);

    const { productId, paymentMethod, couponCode } = request.data as {
      productId: string;
      paymentMethod: "pix" | "credit_card";
      couponCode?: string;
    };

    if (!productId) throw new HttpsError("invalid-argument", "productId obrigatório");
    if (!["pix", "credit_card"].includes(paymentMethod)) {
      throw new HttpsError("invalid-argument", "paymentMethod inválido");
    }
    if (paymentMethod === "credit_card") {
      throw new HttpsError("unimplemented", "Cartão de crédito ainda não disponível");
    }

    const db = admin.firestore();

    // ============================================
    // Validar produto
    // ============================================
    const productSnap = await db.collection("products").doc(productId).get();
    if (!productSnap.exists) throw new HttpsError("not-found", "Produto não encontrado");

    const product = productSnap.data()!;
    if (product.status !== "approved" || product.isDeleted) {
      throw new HttpsError("failed-precondition", "Produto indisponível");
    }
    if (product.ownerId === uid) {
      throw new HttpsError("failed-precondition", "Você não pode comprar seu próprio produto");
    }
    if (product.isFree || product.price === 0) {
      throw new HttpsError("failed-precondition", "Use createFreeProductPurchase para produtos gratuitos");
    }

    // ============================================
    // Validar usuário comprador
    // ============================================
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) throw new HttpsError("not-found", "Usuário não encontrado");
    const userData = userSnap.data()!;

    // ============================================
    // Idempotência via runTransaction()
    // ============================================
    const purchaseId = `${uid}_${productId}`;

    const existingResult = await db.runTransaction(async (tx) => {
      // 1. Purchase ativa?
      const purchaseRef = db.collection("purchases").doc(purchaseId);
      const purchaseSnap = await tx.get(purchaseRef);
      if (purchaseSnap.exists && purchaseSnap.data()?.status === "active") {
        throw new HttpsError("already-exists", "Você já possui este produto");
      }

      // 2. Sale paid?
      const paidSales = await db.collection("sales")
        .where("buyerId", "==", uid)
        .where("productId", "==", productId)
        .where("status", "==", "paid")
        .limit(1)
        .get();
      if (!paidSales.empty) {
        throw new HttpsError("already-exists", "Você já pagou por este produto");
      }

      // 3. Sale pending? → retornar existente
      const pendingSales = await db.collection("sales")
        .where("buyerId", "==", uid)
        .where("productId", "==", productId)
        .where("status", "==", "pending")
        .limit(1)
        .get();

      if (!pendingSales.empty) {
        const existing = pendingSales.docs[0].data();
        return {
          existing: true,
          saleId: pendingSales.docs[0].id,
          pixCopyPaste: existing.pixCopyPaste ?? null,
          checkoutUrl: existing.checkoutUrl ?? null,
        };
      }

      return { existing: false };
    });

    // Retornar cobrança existente
    if (existingResult.existing) {
      await createAuditLog({
        action: "payment_existing_returned",
        performedBy: uid,
        targetId: existingResult.saleId!,
        targetType: "sale",
        metadata: { productId },
        req: request.rawRequest,
      });

      return {
        saleId: existingResult.saleId,
        pixCopyPaste: existingResult.pixCopyPaste,
        checkoutUrl: existingResult.checkoutUrl,
        pixQrCode: null, // QR não guardado — usuário deve gerar novo
      };
    }

    // ============================================
    // Criar cobrança no Asaas
    // ============================================
    // ============================================
    // Pricing — motor único (valida cupom + calcula desconto)
    // Sem cupom: finalAmount = product.price. Com cupom inválido: erro.
    // ============================================
    const pricing = await buildPurchasePricing({
      couponCode,
      amount: product.price,
    });
    if (!pricing.valid) {
      throw new HttpsError("failed-precondition", pricing.reason ?? "Cupom inválido");
    }

    const { platformCommission, sellerAmount } = calculateCommission(pricing.finalAmount);

    // Busca ou cria customer Asaas
    const customer = await findOrCreateCustomer({
      name: userData.name ?? "Usuário Lumina",
      email: userData.email ?? `${uid}@lumina.app`,
      cpfCnpj: userData.cpf,
      externalReference: uid,
    });

    // ============================================
    // Correção do vínculo Sale ↔ Payment (solução B):
    // gera o saleId ANTES de criar a cobrança, para que o
    // externalReference já nasça correto. Assim o webhook
    // (que usa payment.externalReference) sempre acha a sale.
    // ============================================
    const saleRef = db.collection("sales").doc(); // gera ID sem gravar

    // Cria cobrança Pix — valor COM desconto, referência = saleId
    const pixPayment = await createPixPayment({
      customerId: customer.id,
      value: pricing.finalAmount,
      description: `Lumina: ${product.title}`,
      externalReference: saleRef.id,
      dueDate: formatDueDate(1),
    });

    // ============================================
    // Grava a sale com o MESMO id usado na cobrança — valores CONGELADOS
    // ============================================
    await saleRef.set({
      buyerId: uid,
      sellerId: product.ownerId,
      productId,
      purchaseId,
      amount: pricing.finalAmount,          // valor efetivamente cobrado
      platformCommission,
      sellerAmount,
      // --- pricing congelado (auditável mesmo se o cupom mudar depois) ---
      originalAmount: pricing.originalAmount,
      discountAmount: pricing.discountAmount,
      finalAmount: pricing.finalAmount,
      couponId: pricing.couponId ?? null,
      couponCode: pricing.couponCode ?? null,
      couponType: pricing.couponType ?? null,
      couponValue: pricing.couponValue ?? null,
      // ------------------------------------------------------------------
      status: "pending",
      paymentStatus: "pending",
      paymentProvider: "asaas",
      paymentId: pixPayment.id,
      paymentMethod: "pix",
      checkoutUrl: pixPayment.invoiceUrl,
      pixCopyPaste: pixPayment.pixCopyPaste ?? null,
      // pixQrCode: NUNCA salvar no Firestore
      isChargebacked: false,
      webhookProcessedAt: null,
      lastWebhookEvent: null,
      lastWebhookAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await createAuditLog({
      action: "payment_initiated",
      performedBy: uid,
      targetId: saleRef.id,
      targetType: "sale",
      metadata: {
        productId,
        paymentMethod: "pix",
        amount: pricing.finalAmount,
        originalAmount: pricing.originalAmount,
        discountAmount: pricing.discountAmount,
        couponCode: pricing.couponCode,
        asaasPaymentId: pixPayment.id,
      },
      req: request.rawRequest,
    });

    return {
      saleId: saleRef.id,
      pixQrCode: pixPayment.pixQrCode ?? null,   // base64 — apenas na response
      pixCopyPaste: pixPayment.pixCopyPaste ?? null,
      checkoutUrl: pixPayment.invoiceUrl,
    };
  }
);
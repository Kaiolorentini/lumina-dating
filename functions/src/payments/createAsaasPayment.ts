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

    const { productId, paymentMethod } = request.data as {
      productId: string;
      paymentMethod: "pix" | "credit_card";
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
    const { platformCommission, sellerAmount } = calculateCommission(product.price);

    // Busca ou cria customer Asaas
    const customer = await findOrCreateCustomer({
      name: userData.name ?? "Usuário Lumina",
      email: userData.email ?? `${uid}@lumina.app`,
      cpfCnpj: userData.cpf,
      externalReference: uid,
    });

    // Cria cobrança Pix
    const pixPayment = await createPixPayment({
      customerId: customer.id,
      value: product.price,
      description: `Lumina: ${product.title}`,
      externalReference: "", // será preenchido com saleId abaixo
      dueDate: formatDueDate(1),
    });

    // ============================================
    // Salvar sale no Firestore
    // ============================================
    const saleRef = await db.collection("sales").add({
      buyerId: uid,
      sellerId: product.ownerId,
      productId,
      purchaseId,
      amount: product.price,
      platformCommission,
      sellerAmount,
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
        amount: product.price,
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
// ============================================
// CREATE ASAAS PAYMENT — FASE 6B
//
// ⚠️ API_TODO #7 — ASAAS_API_KEY necessária
// Quando tiver a API Key:
// 1. Configurar secret ASAAS_API_KEY
// 2. Remover o throw de "API_TODO #8"
// 3. Descomentar os blocos marcados
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { calculateCommission } from "../utils/calculateCommission";
import { createAuditLog } from "../utils/auditLog";

export const createAsaasPayment = onCall(
  {
    // API_TODO #9: descomentar quando secrets estiverem configurados
    // secrets: ["ASAAS_API_KEY", "ASAAS_ENVIRONMENT"],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Não autenticado");
    const safeUid: string = uid; // narrowing explícito para código inalcançável

    await assertUserNotBlocked(safeUid);

    const { productId, paymentMethod } = request.data as {
      productId: string;
      paymentMethod: "pix" | "credit_card";
    };

    if (!productId) throw new HttpsError("invalid-argument", "productId obrigatório");
    if (!["pix", "credit_card"].includes(paymentMethod)) {
      throw new HttpsError("invalid-argument", "paymentMethod inválido");
    }

    const db = admin.firestore();

    const productSnap = await db.collection("products").doc(productId).get();
    if (!productSnap.exists) throw new HttpsError("not-found", "Produto não encontrado");

    const product = productSnap.data()!;
    if (product.status !== "approved" || product.isDeleted) {
      throw new HttpsError("failed-precondition", "Produto indisponível");
    }
    if (product.ownerId === safeUid) {
      throw new HttpsError("failed-precondition", "Você não pode comprar seu próprio produto");
    }
    if (product.isFree || product.price === 0) {
      throw new HttpsError("failed-precondition", "Use createFreeProductPurchase para produtos gratuitos");
    }

    const purchaseId = `${safeUid}_${productId}`;
    const purchaseSnap = await db.collection("purchases").doc(purchaseId).get();
    if (purchaseSnap.exists && purchaseSnap.data()?.status === "active") {
      throw new HttpsError("already-exists", "Você já possui este produto");
    }

    const existingSale = await db.collection("sales")
      .where("buyerId", "==", safeUid)
      .where("productId", "==", productId)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existingSale.empty) {
      const existingSaleData = existingSale.docs[0].data();
      throw new HttpsError(
        "already-exists",
        `Já existe uma cobrança pendente. CheckoutUrl: ${existingSaleData.checkoutUrl ?? "indisponível"}`
      );
    }

    const { platformCommission, sellerAmount } = calculateCommission(product.price);

    // ============================================
    // API_TODO #8 — Implementar chamada Asaas
    // Descomentar quando ASAAS_API_KEY estiver disponível:
    //
    // const axios = require("axios");
    // const env = process.env.ASAAS_ENVIRONMENT ?? "sandbox";
    // const apiKey = process.env.ASAAS_API_KEY!;
    // const baseUrl = env === "sandbox"
    //   ? "https://sandbox.asaas.com/api/v3"
    //   : "https://api.asaas.com/api/v3";
    //
    // ... (criar customer, criar cobrança, etc.)
    //
    // REMOVER ESTE THROW quando descomentar:
    throw new HttpsError(
      "unimplemented",
      "Integração Asaas pendente. Configure ASAAS_API_KEY para habilitar pagamentos."
    );
    // ============================================

    const saleRef = await db.collection("sales").add({
      buyerId: safeUid,
      sellerId: product.ownerId,
      productId,
      purchaseId,
      amount: product.price,
      platformCommission,
      sellerAmount,
      status: "pending",
      paymentStatus: "pending",
      paymentProvider: "asaas",
      paymentId: "",
      paymentMethod,
      isChargebacked: false,
      webhookProcessedAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await createAuditLog({
      action: "payment_initiated",
      performedBy: safeUid,
      targetId: saleRef.id,
      targetType: "sale",
      metadata: { productId, paymentMethod, amount: product.price },
      req: request.rawRequest,
    });

    return { saleId: saleRef.id };
  }
);
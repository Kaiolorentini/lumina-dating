import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";
import { incrementMetrics } from "../utils/incrementMetric";

export const createFreeProductPurchase = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Não autenticado");

  await assertUserNotBlocked(uid);

  const { productId } = request.data as { productId: string };
  if (!productId) throw new HttpsError("invalid-argument", "productId obrigatório");

  const db = admin.firestore();

  // Busca produto
  const productSnap = await db.collection("products").doc(productId).get();
  if (!productSnap.exists) {
    throw new HttpsError("not-found", "Produto não encontrado");
  }

  const product = productSnap.data()!;

  if (product.status !== "approved" || product.isDeleted) {
    throw new HttpsError("failed-precondition", "Produto indisponível");
  }

  if (!product.isFree || product.price !== 0) {
    throw new HttpsError("failed-precondition", "Este produto não é gratuito");
  }

  if (product.ownerId === uid) {
    throw new HttpsError("failed-precondition", "Você não pode baixar seu próprio produto");
  }

  const purchaseId = `${uid}_${productId}`;
  const purchaseRef = db.collection("purchases").doc(purchaseId);

  await db.runTransaction(async (tx) => {
    const existingPurchase = await tx.get(purchaseRef);

    // Idempotente — se já tem purchase ativa, retorna sem erro
    if (existingPurchase.exists && existingPurchase.data()?.status === "active") {
      return;
    }

    // Cria sale gratuita
    const saleRef = db.collection("sales").doc();
    tx.set(saleRef, {
      buyerId: uid,
      sellerId: product.ownerId,
      productId,
      purchaseId,
      amount: 0,
      platformCommission: 0,
      sellerAmount: 0,
      status: "paid",
      paymentStatus: "received",
      paymentProvider: "asaas",
      paymentId: "free",
      paymentMethod: "free",
      isChargebacked: false,
      webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Cria purchase
    tx.set(purchaseRef, {
      buyerId: uid,
      sellerId: product.ownerId,
      productId,
      saleId: saleRef.id,
      amount: 0,
      status: "active",
      isRevoked: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await incrementMetrics({
    totalSales: 1,
    totalProductsSold: 1,
    todaySales: 1,
  });

  await createAuditLog({
    action: "free_purchase_created",
    performedBy: uid,
    targetId: purchaseId,
    targetType: "product",
    metadata: { productId },
    req: request.rawRequest,
  });

  return { success: true, purchaseId };
});
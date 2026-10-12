// ============================================
// LUMINA — APROVAR PRODUTO
// functions/src/products/onApproveProduct.ts
//
// 12/10/2026 — QUESTIONÁRIO OBRIGATÓRIO.
// A aprovação só acontece com o questionário de moderação completo
// (config/productChecklist.ts) e com TODOS os itens aprovados. O
// servidor confere a lista — não basta o app esconder o botão. O
// registro da análise vai para moderationRecords na MESMA transação
// que publica o produto: não existe produto aprovado sem registro.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";
import { incrementMetric } from "../utils/incrementMetric";
import { notifyUser } from "../utils/notifyUser";
import { isBelowMinimumPrice } from "../config/marketplacePricing";
import { ChecklistError, parseProductChecklist } from "../config/productChecklist";
import { snapshotProduct, writeProductModerationRecord } from "../moderation/moderationRecords";

export const onApproveProduct = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertSuperAdmin(uid);
  await assertUserNotBlocked(uid);

  const { productId, checklist } = (request.data ?? {}) as { productId?: unknown; checklist?: unknown };
  if (typeof productId !== "string" || !productId || productId.includes("/")) {
    throw new HttpsError("invalid-argument", "productId obrigatório");
  }

  let parsed;
  try {
    parsed = parseProductChecklist(checklist);
  } catch (error) {
    if (error instanceof ChecklistError) throw new HttpsError("failed-precondition", error.message);
    throw error;
  }
  if (!parsed.allApproved) {
    throw new HttpsError(
      "failed-precondition",
      "Há itens negados no questionário. Para publicar, todos os itens precisam estar aprovados — ou recuse o produto.",
    );
  }

  const db = admin.firestore();
  const productRef = db.collection("products").doc(productId);

  let ownerId = "";
  let recordId = "";

  await db.runTransaction(async (tx) => {
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists) {
      throw new HttpsError("not-found", "Produto não encontrado");
    }
    const product = productSnap.data()!;
    if (product.status !== "pending") {
      throw new HttpsError("failed-precondition", "Produto não está pendente de aprovação");
    }
    // Preço mínimo (09/10/2026): produto pago abaixo de R$ 19,99 não
    // entra na vitrine — o admin recusa com o motivo para o criador ajustar.
    if (isBelowMinimumPrice(product.price)) {
      throw new HttpsError(
        "failed-precondition",
        "Preço abaixo do mínimo de R$ 19,99. Recuse o produto pedindo para o criador ajustar o preço.",
      );
    }

    ownerId = String(product.ownerId ?? "");

    tx.update(productRef, {
      status: "approved",
      version: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    recordId = writeProductModerationRecord(tx, {
      type: "product",
      productId,
      ownerId,
      reviewerUid: uid,
      checklist: parsed,
      outcome: "approved",
      reason: null,
      childSafetyFlag: false,
      snapshot: snapshotProduct(product),
    });
  });

  await incrementMetric("totalProducts");

  await createAuditLog({
    action: "product_approved",
    performedBy: uid,
    targetId: productId,
    targetType: "product",
    metadata: { ownerId, moderationRecordId: recordId, checklistVersion: parsed.version },
    req: request.rawRequest,
  });

  // ✅ Notifica o criador — push + in-app
  if (ownerId) {
    await notifyUser({
      userId: ownerId,
      title: "✅ Produto aprovado!",
      body: "Seu produto foi aprovado e já está disponível no marketplace.",
      type: "product_approved",
      data: { productId },
    });
  }

  return { success: true, moderationRecordId: recordId };
});

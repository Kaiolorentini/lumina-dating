// ============================================
// LUMINA — RECUSAR PRODUTO
// functions/src/products/onRejectProduct.ts
//
// 12/10/2026 — QUESTIONÁRIO OBRIGATÓRIO.
// A recusa exige o questionário completo com PELO MENOS UM item
// negado. O motivo enviado ao criador é montado pelo SERVIDOR a partir
// dos itens negados (mais a observação do admin em cada um), para o
// texto ser sempre o oficial. O registro vai para moderationRecords na
// mesma transação.
//
// Item de proteção de menores negado: além da recusa, alerta interno
// para os superadmins revisarem a conta do criador.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";
import { notifyUser } from "../utils/notifyUser";
import { notifyAdmins } from "../utils/notifyAdmins";
import {
  ChecklistError, buildRejectionReason, hasChildSafetyRejection, parseProductChecklist,
} from "../config/productChecklist";
import { snapshotProduct, writeProductModerationRecord } from "../moderation/moderationRecords";

export const onRejectProduct = onCall(async (request) => {
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
  if (parsed.allApproved) {
    throw new HttpsError("failed-precondition", "Para recusar, marque como negado o item que motivou a recusa.");
  }

  const reason = buildRejectionReason(parsed);
  const childSafetyFlag = hasChildSafetyRejection(parsed);

  const db = admin.firestore();
  const productRef = db.collection("products").doc(productId);

  const result = await db.runTransaction(async (tx) => {
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists) {
      throw new HttpsError("not-found", "Produto não encontrado");
    }
    const product = productSnap.data()!;
    if (!["pending", "approved"].includes(product.status)) {
      throw new HttpsError("failed-precondition", "Produto não pode ser rejeitado neste estado");
    }

    const ownerId = String(product.ownerId ?? "");

    tx.update(productRef, {
      status: "rejected",
      rejectionReason: reason,
      // Recusado sai do carrossel de destaque.
      isFeatured: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const recordId = writeProductModerationRecord(tx, {
      type: "product",
      productId,
      ownerId,
      reviewerUid: uid,
      checklist: parsed,
      outcome: "rejected",
      reason,
      childSafetyFlag,
      snapshot: snapshotProduct(product),
    });

    return { ownerId, recordId, title: String(product.title ?? "seu produto") };
  });

  await createAuditLog({
    action: "product_rejected",
    performedBy: uid,
    targetId: productId,
    targetType: "product",
    metadata: {
      ownerId: result.ownerId,
      moderationRecordId: result.recordId,
      rejectedItems: parsed.rejectedIds,
      childSafetyFlag,
    },
    req: request.rawRequest,
  });

  if (childSafetyFlag) {
    console.warn("[onRejectProduct] alerta de proteção de menores", JSON.stringify({
      productId, ownerId: result.ownerId, moderationRecordId: result.recordId,
    }));
    await notifyAdmins({
      title: "🚨 Proteção de menores",
      body: `Produto "${result.title}" recusado por item de proteção de menores. Revise a conta do criador.`,
      type: "child_safety_alert",
      data: { productId, ownerId: result.ownerId },
    }).catch((error: unknown) => console.error("[onRejectProduct] alerta falhou:", error));
  }

  // ✅ Notifica o criador — push + in-app
  if (result.ownerId) {
    await notifyUser({
      userId: result.ownerId,
      title: "❌ Produto não aprovado",
      body: `"${result.title}" precisa de ajustes:\n${reason}`,
      type: "product_rejected",
      data: { productId },
    });
  }

  return { success: true, moderationRecordId: result.recordId };
});

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";

const SIGNED_URL_EXPIRY_MS = 5 * 60 * 1000;
const RATE_LIMIT_PER_HOUR = 30;
const RATE_LIMIT_PER_MINUTE = 5;

// ✅ Tipo explícito em vez de Parameters<typeof HttpsError>[0]
type HttpsErrorCode =
  | "ok" | "cancelled" | "unknown" | "invalid-argument"
  | "deadline-exceeded" | "not-found" | "already-exists"
  | "permission-denied" | "resource-exhausted" | "failed-precondition"
  | "aborted" | "out-of-range" | "unimplemented" | "internal"
  | "unavailable" | "data-loss" | "unauthenticated";

export const getSignedUrl = onCall(async (request) => {
  const uid = request.auth?.uid ?? null;
  const { productId, storagePath } = (request.data ?? {}) as {
    productId?: string;
    storagePath?: string;
  };

  // ✅ Helper com tipo explícito
  async function denyAccess(
    reason: string,
    code: HttpsErrorCode,
    userMessage: string
  ): Promise<never> {
    try {
      await createAuditLog({
        action: "content_access_denied",
        performedBy: uid ?? "anonymous",
        targetId: productId ?? "unknown",
        targetType: "product",
        metadata: {
          storagePath: storagePath ?? "unknown",
          reason,
          requestedBy: uid ?? "anonymous",
        },
        req: request.rawRequest,
      });
    } catch {
      // falha silenciosa — auditoria nunca bloqueia o fluxo
    }
    throw new HttpsError(code, userMessage);
  }

  // Autenticação
  if (!uid) {
    return denyAccess("auth_missing", "unauthenticated", "Não autenticado");
  }

  if (!productId) {
    return denyAccess("product_id_missing", "invalid-argument", "productId obrigatório");
  }
  if (!storagePath) {
    return denyAccess("storage_path_missing", "invalid-argument", "storagePath obrigatório");
  }

  // Usuário não bloqueado
  try {
    await assertUserNotBlocked(uid);
  } catch {
    return denyAccess("user_blocked", "permission-denied", "Acesso negado");
  }

  const db = admin.firestore();

  // Rate limit
  const now = Date.now();
  const currentHour = Math.floor(now / (60 * 60 * 1000));
  const currentMinute = Math.floor(now / (60 * 1000));

  const hourRef = db.collection("contentAccessLogs").doc(uid)
    .collection("counts").doc(String(currentHour));
  const minuteRef = db.collection("contentAccessLogs").doc(uid)
    .collection("minutes").doc(String(currentMinute));

  const [hourSnap, minuteSnap] = await Promise.all([hourRef.get(), minuteRef.get()]);
  const hourCount = hourSnap.data()?.count ?? 0;
  const minuteCount = minuteSnap.data()?.count ?? 0;

  if (hourCount >= RATE_LIMIT_PER_HOUR) {
    return denyAccess(
      `rate_limit_hour_exceeded:${hourCount}`,
      "resource-exhausted",
      "Limite de acessos atingido. Tente novamente mais tarde."
    );
  }
  if (minuteCount >= RATE_LIMIT_PER_MINUTE) {
    return denyAccess(
      `rate_limit_minute_exceeded:${minuteCount}`,
      "resource-exhausted",
      "Muitas requisições. Aguarde um momento."
    );
  }

  // StoragePath — camada 1: prefixo
  const expectedPrefix = `marketplace/products/${productId}/files/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return denyAccess(
      `invalid_path_prefix:${storagePath}`,
      "permission-denied",
      "Acesso negado"
    );
  }

  // Purchase ativa
  const purchaseId = `${uid}_${productId}`;
  const purchaseSnap = await db.collection("purchases").doc(purchaseId).get();

  if (!purchaseSnap.exists) {
    return denyAccess("purchase_not_found", "permission-denied", "Acesso negado");
  }

  const purchase = purchaseSnap.data()!;

  if (purchase.status !== "active") {
    return denyAccess(
      `purchase_status_invalid:${purchase.status}`,
      "permission-denied",
      "Acesso inativo para este produto"
    );
  }
  if (purchase.isRevoked === true) {
    return denyAccess("purchase_revoked", "permission-denied", "Acesso revogado");
  }
  if (purchase.buyerId !== uid) {
    return denyAccess(`purchase_buyer_mismatch`, "permission-denied", "Acesso negado");
  }
  if (purchase.productId !== productId) {
    return denyAccess(`purchase_product_mismatch`, "permission-denied", "Acesso negado");
  }

  // Produto aprovado
  const productSnap = await db.collection("products").doc(productId).get();

  if (!productSnap.exists) {
    return denyAccess("product_not_found", "not-found", "Produto não encontrado");
  }

  const product = productSnap.data()!;

  if (product.status !== "approved") {
    return denyAccess(
      `product_status_invalid:${product.status}`,
      "failed-precondition",
      "Produto indisponível"
    );
  }
  if (product.isDeleted === true) {
    return denyAccess("product_deleted", "not-found", "Produto não encontrado");
  }

  // StoragePath — camada 2: ownership do arquivo
  const files: Array<{ storagePath: string }> = product.files ?? [];
  const fileExists = files.some((f) => f.storagePath === storagePath);

  if (!fileExists) {
    return denyAccess(
      `file_not_in_product:${storagePath}`,
      "permission-denied",
      "Acesso negado"
    );
  }

  // Gerar Signed URL — 5 minutos
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);

  let signedUrl: string;
  try {
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + SIGNED_URL_EXPIRY_MS,
      responseDisposition: "attachment",
    });
    signedUrl = url;
  } catch (error) {
    return denyAccess(
      `signed_url_generation_failed:${String(error)}`,
      "internal",
      "Erro ao carregar conteúdo"
    );
  }

  // Incrementar rate limit
  const batch = db.batch();
  batch.set(hourRef, { count: admin.firestore.FieldValue.increment(1) }, { merge: true });
  batch.set(minuteRef, { count: admin.firestore.FieldValue.increment(1) }, { merge: true });
  await batch.commit();

  await createAuditLog({
    action: "content_accessed",
    performedBy: uid,
    targetId: productId,
    targetType: "product",
    metadata: { storagePath, purchaseId },
    req: request.rawRequest,
  });

  return { url: signedUrl };
});
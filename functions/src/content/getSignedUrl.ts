// ============================================
// LUMINA — LINK TEMPORÁRIO PARA CONTEÚDO COMPRADO
// functions/src/content/getSignedUrl.ts
//
// O acesso é da COMPRA: produto tirado da venda continua acessível a
// quem comprou, e arquivos em análise ou removidos antes da compra
// ficam de fora (isVisibleToBuyer).
//
// v3 (29/09):
// - Link "inline" (exibir no app). Com "attachment", o sistema
//   tratava como download e o leitor de PDF não abria.
// - Validade por tipo: vídeo 2 h (a reprodução inteira sem trocar de
//   link); imagem e PDF 15 min (carregam de uma vez).
// - Limite por minuto de 5 para 10: trocar entre os arquivos de um
//   produto não é abuso.
// - Contadores com expireAt: apagados pela política de TTL (grupos
//   'counts' e 'minutes'), em vez de acumular para sempre.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";
import { ProductFileEntry, isVisibleToBuyer } from "../products/productFiles";

const VIDEO_URL_EXPIRY_MS   = 2 * 60 * 60 * 1000;
const DEFAULT_URL_EXPIRY_MS = 15 * 60 * 1000;
const RATE_LIMIT_PER_HOUR   = 30;
const RATE_LIMIT_PER_MINUTE = 10;
/** Contadores do limite somem sozinhos (política de TTL no campo expireAt). */
const COUNTER_TTL_MS = 2 * 24 * 60 * 60 * 1000;

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
      // auditoria nunca bloqueia o fluxo
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

  // Limite de acessos
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

  // Caminho — camada 1: prefixo do produto
  const expectedPrefix = `marketplace/products/${productId}/files/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return denyAccess(
      `invalid_path_prefix:${storagePath}`,
      "permission-denied",
      "Acesso negado"
    );
  }

  // Compra ativa
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
    return denyAccess("purchase_buyer_mismatch", "permission-denied", "Acesso negado");
  }
  if (purchase.productId !== productId) {
    return denyAccess("purchase_product_mismatch", "permission-denied", "Acesso negado");
  }

  // Produto — o acesso é da COMPRA. Produto tirado da venda
  // (isDeleted) continua acessível a quem comprou.
  const productSnap = await db.collection("products").doc(productId).get();

  if (!productSnap.exists) {
    return denyAccess("product_not_found", "not-found", "Produto não encontrado");
  }

  const product = productSnap.data()!;

  // Caminho — camada 2: o arquivo pertence ao produto E está visível
  // para ESTA compra (nem em análise, nem removido antes dela).
  const files: ProductFileEntry[] = product.files ?? [];
  const productFile = files.find((f) => f.storagePath === storagePath);
  const purchasedAt = (purchase.createdAt as admin.firestore.Timestamp | undefined)?.toDate() ?? null;

  if (!productFile || !isVisibleToBuyer(productFile, purchasedAt)) {
    return denyAccess(
      `file_not_visible:${storagePath}`,
      "permission-denied",
      "Acesso negado"
    );
  }

  // Link temporário para EXIBIR no app, com a validade do tipo.
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);
  const mimeType = String((productFile as ProductFileEntry & { mimeType?: string }).mimeType ?? "");
  const expiryMs = mimeType.startsWith("video/") ? VIDEO_URL_EXPIRY_MS : DEFAULT_URL_EXPIRY_MS;

  let signedUrl: string;
  try {
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + expiryMs,
      responseDisposition: "inline",
    });
    signedUrl = url;
  } catch (error) {
    return denyAccess(
      `signed_url_generation_failed:${String(error)}`,
      "internal",
      "Erro ao carregar conteúdo"
    );
  }

  // Contadores do limite, com expiração para o TTL apagar.
  const expireAt = admin.firestore.Timestamp.fromMillis(now + COUNTER_TTL_MS);
  const batch = db.batch();
  batch.set(hourRef, { count: admin.firestore.FieldValue.increment(1), expireAt }, { merge: true });
  batch.set(minuteRef, { count: admin.firestore.FieldValue.increment(1), expireAt }, { merge: true });
  await batch.commit();

  await createAuditLog({
    action: "content_accessed",
    performedBy: uid,
    targetId: productId,
    targetType: "product",
    metadata: { storagePath, purchaseId, expiresInMin: Math.round(expiryMs / 60000) },
    req: request.rawRequest,
  });

  return { url: signedUrl };
});
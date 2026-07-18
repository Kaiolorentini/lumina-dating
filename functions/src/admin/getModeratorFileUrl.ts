// ============================================
// GET MODERATOR FILE URL
//
// Gera uma Signed URL temporária (10 min) de UM arquivo
// pago (files[]) de um produto, exclusivamente para
// SuperAdmins, para fins de moderação de conteúdo.
//
// Segurança:
//   - assertAuthenticated + assertSuperAdmin + assertUserNotBlocked
//   - o arquivo assinado DEVE constar em products/{productId}.files[]
//     (impede assinatura de caminho arbitrário no Storage)
//   - URL expira sozinha em 10 minutos (não é downloadURL permanente)
//   - registra VIEW_MODERATOR_FILE no auditLog
//
// initializeApp() está sem storageBucket → bucket explícito.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";

const URL_TTL_MS = 10 * 60 * 1000; // 10 minutos

interface ProductFileMeta {
  storagePath: string;
  type?: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

export const getModeratorFileUrl = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertSuperAdmin(uid);
  await assertUserNotBlocked(uid);

  const { productId, fileIndex } = request.data as {
    productId?: string;
    fileIndex?: number;
  };

  if (!productId) {
    throw new HttpsError("invalid-argument", "productId obrigatório");
  }
  if (typeof fileIndex !== "number" || fileIndex < 0) {
    throw new HttpsError("invalid-argument", "fileIndex inválido");
  }

  // Busca o produto
  const productSnap = await admin
    .firestore()
    .collection("products")
    .doc(productId)
    .get();

  if (!productSnap.exists) {
    throw new HttpsError("not-found", "Produto não encontrado");
  }

  const files = (productSnap.data()?.files ?? []) as ProductFileMeta[];

  if (fileIndex >= files.length) {
    throw new HttpsError("not-found", "Arquivo não encontrado neste produto");
  }

  const file = files[fileIndex];
  const storagePath = file?.storagePath;

  if (!storagePath || typeof storagePath !== "string") {
    throw new HttpsError(
      "failed-precondition",
      "Arquivo sem caminho de armazenamento válido"
    );
  }

  // Assina a URL — expira sozinha em 10 min
  // Mesmo padrão do content/getSignedUrl (bucket default, sem version v4).
  // Sem responseDisposition → exibe inline (não força download) para moderação.
  let signedUrl: string;
  try {
    const bucket = admin.storage().bucket();
    const [url] = await bucket.file(storagePath).getSignedUrl({
      action: "read",
      expires: Date.now() + URL_TTL_MS,
    });
    signedUrl = url;
  } catch (error: any) {
    console.error("[getModeratorFileUrl] Falha ao assinar URL:", error);
    throw new HttpsError(
      "internal",
      "Não foi possível gerar a URL do arquivo. Verifique a permissão de assinatura (iam.serviceAccountTokenCreator)."
    );
  }

  // Auditoria — quem abriu, qual arquivo, quando
  await createAuditLog({
    action: "VIEW_MODERATOR_FILE",
    performedBy: uid,
    targetId: productId,
    targetType: "product",
    metadata: {
      fileName: file.name ?? storagePath.split("/").pop() ?? "desconhecido",
      fileIndex,
      storagePath,
    },
    req: request.rawRequest,
  });

  return {
    file: {
      name: file.name ?? storagePath.split("/").pop() ?? "arquivo",
      type: file.type ?? "other",
      mimeType: file.mimeType ?? "application/octet-stream",
      size: file.size ?? 0,
      url: signedUrl,
      expiresInSeconds: URL_TTL_MS / 1000,
    },
  };
});
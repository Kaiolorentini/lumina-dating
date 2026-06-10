// ============================================
// VERIFY ASAAS WALLET — FASE 6B
//
// Callable Function — nunca direto do app.
// Cache de 24h para evitar chamadas repetidas.
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { getAccount } from "../utils/asaasClient";
import { createAuditLog } from "../utils/auditLog";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

export const verifyAsaasWallet = onCall(
  {
    secrets: ["ASAAS_API_KEY", "ASAAS_ENVIRONMENT"],
  },
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const uid: string = request.auth!.uid;

    await assertUserNotBlocked(uid);

    const { walletId } = request.data as { walletId: string };
    if (!walletId?.trim()) {
      throw new HttpsError("invalid-argument", "walletId obrigatório");
    }

    const trimmedWalletId = walletId.trim();

    // Validar formato UUID
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(trimmedWalletId)) {
      throw new HttpsError(
        "invalid-argument",
        "Formato inválido. Wallet ID deve ter o formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      );
    }

    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data() ?? {};

    // ============================================
    // Cache: verificado há menos de 24h?
    // ============================================
    const verifiedAt = userData.asaasVerifiedAt?.toDate?.();
    const sameWallet = userData.asaasWalletId === trimmedWalletId;
    const alreadyVerified = userData.asaasAccountStatus === "verified";

    if (verifiedAt && sameWallet && alreadyVerified) {
      const age = Date.now() - verifiedAt.getTime();
      if (age < CACHE_TTL_MS) {
        return {
          valid: true,
          cached: true,
          accountName: userData.asaasAccountName ?? null,
          status: "verified",
        };
      }
    }

    // ============================================
    // Consultar Asaas
    // ============================================
    const account = await getAccount(trimmedWalletId);

    if (!account) {
      await userRef.update({
        asaasWalletId: trimmedWalletId,
        asaasAccountVerified: false,
        asaasAccountStatus: "error",
        asaasVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await createAuditLog({
        action: "wallet_error",
        performedBy: uid,
        targetId: uid,
        targetType: "user",
        metadata: { walletId: trimmedWalletId, reason: "not_found" },
        req: request.rawRequest,
      });

      throw new HttpsError("not-found", "Wallet ID não encontrado no Asaas. Verifique e tente novamente.");
    }

    // ============================================
    // Salvar verificação
    // ============================================
    await userRef.update({
      asaasWalletId: trimmedWalletId,
      asaasAccountVerified: true,
      asaasAccountStatus: "verified",
      asaasAccountName: account.name,
      asaasAccountType: "cpf",
      asaasVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await createAuditLog({
      action: "wallet_verified",
      performedBy: uid,
      targetId: uid,
      targetType: "user",
      metadata: { walletId: trimmedWalletId, accountName: account.name },
      req: request.rawRequest,
    });

    return {
      valid: true,
      cached: false,
      accountName: account.name,
      status: "verified",
    };
  }
);
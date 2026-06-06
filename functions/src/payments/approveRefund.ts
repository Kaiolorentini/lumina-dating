// ============================================
// APPROVE REFUND — FASE 6B
//
// ⚠️ API_TODO #1 — ASAAS_API_KEY necessária
// Quando tiver a API Key:
// 1. Remover o throw de "API_TODO #2"
// 2. Descomentar o bloco axios
// 3. Descomentar secrets: ["ASAAS_API_KEY", "ASAAS_ENVIRONMENT"]
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";

export const approveRefund = onCall(
  {
    // API_TODO #3: descomentar quando secrets estiverem configurados
    // secrets: ["ASAAS_API_KEY", "ASAAS_ENVIRONMENT"],
  },
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const safeUid: string = request.auth!.uid;

    await assertSuperAdmin(safeUid);
    await assertUserNotBlocked(safeUid);

    const { refundRequestId } = request.data as { refundRequestId: string };
    if (!refundRequestId) {
      throw new HttpsError("invalid-argument", "refundRequestId obrigatório");
    }

    const db = admin.firestore();
    const refundRef = db.collection("refundRequests").doc(refundRequestId);
    const refundSnap = await refundRef.get();

    if (!refundSnap.exists) {
      throw new HttpsError("not-found", "Solicitação não encontrada");
    }

    const refund = refundSnap.data()!;
    if (refund.status !== "pending") {
      throw new HttpsError("failed-precondition", "Solicitação já foi processada");
    }

    const saleRef = db.collection("sales").doc(refund.saleId);
    const saleSnap = await saleRef.get();
    const sale = saleSnap.data()!;

    // ============================================
    // API_TODO #2 — Chamar API Asaas para estorno
    // Descomentar quando ASAAS_API_KEY estiver disponível:
    //
    // const env = process.env.ASAAS_ENVIRONMENT ?? "sandbox";
    // const apiKey = process.env.ASAAS_API_KEY!;
    // const baseUrl = env === "sandbox"
    //   ? "https://sandbox.asaas.com/api/v3"
    //   : "https://api.asaas.com/api/v3";
    //
    // const axios = require("axios");
    // try {
    //   await axios.post(
    //     `${baseUrl}/payments/${sale.paymentId}/refund`,
    //     {},
    //     { headers: { access_token: apiKey } }
    //   );
    // } catch (error: any) {
    //   console.error("[approveRefund] Erro Asaas:", error?.response?.data);
    //   throw new HttpsError("internal", "Erro ao processar estorno no Asaas");
    // }
    //
    // REMOVER ESTE THROW quando descomentar o bloco acima:
    throw new HttpsError(
      "unimplemented",
      "Integração Asaas pendente. Configure ASAAS_API_KEY para habilitar reembolsos."
    );
    // ============================================

    await db.runTransaction(async (tx) => {
      const walletRef = db.collection("creatorWallets").doc(sale.sellerId);
      const walletSnap = await tx.get(walletRef);
      const wallet = walletSnap.data();

      tx.update(refundRef, {
        status: "approved",
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedBy: safeUid,
      });

      tx.update(saleRef, {
        status: "refunded",
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const purchaseRef = db.collection("purchases").doc(refund.purchaseId);
      tx.update(purchaseRef, {
        status: "refunded",
        isRevoked: true,
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (wallet) {
        const fromPending = Math.min(wallet.pendingBalance ?? 0, sale.sellerAmount);
        const fromAvailable = sale.sellerAmount - fromPending;
        tx.update(walletRef, {
          pendingBalance: admin.firestore.FieldValue.increment(-fromPending),
          availableBalance: admin.firestore.FieldValue.increment(-fromAvailable),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      const txRef = db.collection("creatorTransactions").doc();
      tx.set(txRef, {
        userId: sale.sellerId,
        type: "refund",
        amount: -sale.sellerAmount,
        description: `Reembolso aprovado: ${sale.productId}`,
        saleId: refund.saleId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await createAuditLog({
      action: "refund_approved",
      performedBy: safeUid,
      targetId: refundRequestId,
      targetType: "sale",
      metadata: {
        saleId: refund.saleId,
        amount: refund.amount,
        buyerId: refund.buyerId,
      },
      req: request.rawRequest,
    });

    return { success: true };
  }
);
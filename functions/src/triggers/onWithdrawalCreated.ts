// ============================================
// TRIGGER — onWithdrawalCreated
//
// Dispara quando um novo withdrawals/{id} é criado.
// 1. Valida se o creator já não tem outro saque pendente/aprovado
// 2. Notifica os admins no backend (confiável).
// ============================================

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { notifyAdmins } from "../utils/notifyAdmins";

export const onWithdrawalCreated = onDocumentCreated(
  "withdrawals/{withdrawalId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    if (data.status && data.status !== "pending") return;

    const userId = data.userId as string | undefined;
    if (!userId) return;

    const amount = typeof data.amount === "number" ? data.amount : 0;
    const db = admin.firestore();
    const withdrawalRef = event.data!.ref;

    // Trava server-side: rejeita se já houver saque pendente ou aprovado
    const existing = await db
      .collection("withdrawals")
      .where("userId", "==", userId)
      .where("status", "in", ["pending", "approved"])
      .get();

    if (existing.docs.length > 1) {
      // Mais de um documento = já existia antes desta criação
      await withdrawalRef.update({
        status: "rejected",
        rejectionReason: "Você já possui um pedido de saque pendente.",
      });
      return;
    }

    await notifyAdmins({
      title: "💸 Novo pedido de saque",
      body: `Um criador solicitou saque de R$ ${amount.toFixed(2)}.`,
      type: "withdrawal_request",
      data: { withdrawalId: event.params.withdrawalId },
    }).catch(() => {});
  }
);
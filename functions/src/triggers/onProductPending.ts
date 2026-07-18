// ============================================
// TRIGGER — onProductPending
//
// Dispara em QUALQUER update de products/{id}, mas só
// notifica quando o produto ENTRA em 'pending'
// (transição draft/rejected → pending), ou seja, quando
// o criador envia para revisão.
//
// Filtra as demais transições (ex.: pending → approved na
// aprovação do admin) para não gerar push indevido.
// ============================================

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { notifyAdmins } from "../utils/notifyAdmins";

export const onProductPending = onDocumentUpdated(
  "products/{productId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Só nos interessa quando o status FINAL é 'pending'
    if (after.status !== "pending") return;
    // E quando ANTES não era 'pending' (é uma transição nova)
    if (before.status === "pending") return;

    const title = after.title ?? "um produto";

    await notifyAdmins({
      title: "📦 Produto aguardando moderação",
      body: `"${title}" foi enviado para revisão.`,
      type: "product_pending",
      data: { productId: event.params.productId },
    }).catch(() => {});
  }
);
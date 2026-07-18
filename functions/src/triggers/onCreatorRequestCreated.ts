// ============================================
// TRIGGER — onCreatorRequestCreated
//
// Dispara quando um novo creatorRequests/{id} é criado
// (pelo cliente). Notifica os admins no backend, de forma
// confiável (não depende do app enviar o push).
// ============================================

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { notifyAdmins } from "../utils/notifyAdmins";

export const onCreatorRequestCreated = onDocumentCreated(
  "creatorRequests/{requestId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // Só notifica solicitações pendentes (ignora docs já resolvidos)
    if (data.status && data.status !== "pending") return;

    const userName = data.name ?? data.displayName ?? "Um usuário";

    await notifyAdmins({
      title: "🎨 Nova solicitação de criador",
      body: `${userName} solicitou acesso de criador.`,
      type: "creator_request",
      data: { requestId: event.params.requestId },
    }).catch(() => {});
  }
);
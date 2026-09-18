// ============================================
// LUMINA — RESTAURAÇÃO SOB DEMANDA
// functions/src/users/restoreCreatorIfExpired.ts
//
// Chamada pelo app na abertura. Se o ban temporário
// venceu, devolve o papel e limpa os campos na hora.
//
// Só o PRÓPRIO usuário chama para si mesmo. Não há risco
// de escalada: a função nunca concede papel novo, só
// devolve o previousRole que o blockUser guardou, e só
// depois do prazo vencido.
//
// Idempotente: sem ban vencido, não escreve nada.
// ============================================

import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated } from "../utils/adminGuard";
import { buildRestorePatch } from "../utils/marketplaceBan";
import { notifyUser } from "../utils/notifyUser";

interface RestoreResult {
  restored: boolean;
  role: string | null;
}

export const restoreCreatorIfExpired = onCall<void, Promise<RestoreResult>>(
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    const uid: string = request.auth!.uid;

    const userRef = admin.firestore().collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) return { restored: false, role: null };

    const data = snap.data();
    const patch = buildRestorePatch(data);
    if (!patch) return { restored: false, role: null };

    await userRef.update(patch);

    const restoredRole = typeof patch.role === "string" ? patch.role : null;
    console.log(`[restoreCreatorIfExpired] Ban expirado restaurado: ${uid}`, { restoredRole });

    if (restoredRole) {
      await notifyUser({
        userId: uid,
        title: "✅ Suas ferramentas de criador voltaram",
        body: "O período de suspensão terminou. Você já pode publicar e vender novamente.",
        type: "marketplace_unbanned",
      });
    }

    return { restored: true, role: restoredRole };
  }
);
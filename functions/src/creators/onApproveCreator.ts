import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";
import { incrementMetric } from "../utils/incrementMetric";
import { notifyUser } from "../utils/notifyUser";
import { FieldValue } from "firebase-admin/firestore";

export const onApproveCreator = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertSuperAdmin(uid);
  await assertUserNotBlocked(uid);

  const { requestId, userId } = request.data as {
    requestId: string;
    userId: string;
  };

  if (!requestId || !userId) {
    throw new HttpsError("invalid-argument", "requestId e userId são obrigatórios");
  }

  const db = admin.firestore();

  await db.runTransaction(async (tx) => {
    const requestRef = db.collection("creatorRequests").doc(requestId);
    const userRef = db.collection("users").doc(userId);

    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists) {
      throw new HttpsError("not-found", "Solicitação não encontrada");
    }
    if (requestSnap.data()?.status !== "pending") {
      throw new HttpsError("failed-precondition", "Solicitação já foi processada");
    }

    tx.update(requestRef, {
      status: "approved",
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: uid,
    });

    tx.update(userRef, { role: "creator" });

    // Moldura Forja — concedida junto com o papel, na mesma
    // transação: se o role gravar e a moldura não, o criador fica
    // sem a insígnia e ninguém percebe.
    //
    // pendingCosmeticReveal marca o que ainda não foi comemorado.
    // Sem ela o app não teria como saber se a moldura é nova ou
    // se o usuário já a viu — e o modal apareceria toda vez.
    tx.set(userRef, {
      progression: {
        unlockedItems:          { frame_forja: true },
        pendingCosmeticReveal:  'frame_forja',
      },
    }, { merge: true });
  });

  await incrementMetric("totalCreators");

  await createAuditLog({
    action: "creator_approved",
    performedBy: uid,
    targetId: requestId,
    targetType: "creator",
    metadata: { userId },
    req: request.rawRequest,
  });

  // ✅ Notifica o usuário aprovado — push + in-app
  await notifyUser({
    userId,
    title: "🔥 Você é um Criador!",
    body: "Sua solicitação foi aprovada e a moldura Forja é sua. Comece a publicar!",
    type: "creator_approved",
    data: { requestId },
  });

  // Conquista CREATOR_ZERO — fire-and-forget, fora da transaction.
  // O trigger vai para o UID APROVADO, não para o admin que aprovou:
  // a conquista é de quem virou criador.
  db.collection("achievementTriggers").add({
    uid:          userId,
    action:       "CREATOR_APPROVED",
    currentValue: 1,
    processedAt:  null,
    timestamp:    FieldValue.serverTimestamp(),
  }).catch(() => {});

  return { success: true };
});
// ============================================
// CREATE FRAUD FLAG — helper reutilizável
//
// Cria uma sinalização em fraudFlags de forma idempotente:
// se já existe uma flag do mesmo userId + reason com status
// 'open' ou 'reviewing', NÃO cria outra (evita duplicatas).
//
// Ao criar uma flag NOVA, notifica os admins (notifyAdmins).
//
// Usado por gatilhos de fraude (screenshots/piracy, chargeback,
// abuse, multiaccount, spam, suspicious_activity).
//
// SEMPRE chamar como fire-and-forget no chamador:
//   createFraudFlag({...}).catch(() => {});
// Nunca deve derrubar o fluxo principal.
// ============================================

import * as admin from "firebase-admin";
import { notifyAdmins } from "./notifyAdmins";

export type FraudReason =
  | "chargeback"
  | "spam"
  | "multiaccount"
  | "abuse"
  | "piracy"
  | "suspicious_activity";

const REASON_LABEL: Record<FraudReason, string> = {
  chargeback: "Chargeback",
  spam: "Spam",
  multiaccount: "Multi-conta",
  abuse: "Abuso",
  piracy: "Pirataria",
  suspicious_activity: "Atividade suspeita",
};

interface CreateFraudFlagInput {
  userId: string;
  reason: FraudReason;
  description: string;
  relatedProductId?: string;
  relatedSaleId?: string;
}

export async function createFraudFlag(
  input: CreateFraudFlagInput
): Promise<{ created: boolean; id: string | null }> {
  const { userId, reason, description, relatedProductId, relatedSaleId } = input;

  if (!userId || !reason) {
    console.warn("[createFraudFlag] userId/reason ausente — ignorando");
    return { created: false, id: null };
  }

  const col = admin.firestore().collection("fraudFlags");

  // 0. Não criar flag para usuário já bloqueado (evita flags infinitas
  //    de alguém que já está banido e continua tentando).
  try {
    const userSnap = await admin.firestore().collection("users").doc(userId).get();
    if (userSnap.data()?.isBlocked === true) {
      return { created: false, id: null };
    }
  } catch (error) {
    // Se a leitura falhar, seguimos — a proteção da flag é mais importante.
    console.warn("[createFraudFlag] checagem de bloqueio falhou:", error);
  }

  // 1. Idempotência — já existe flag ativa (open/reviewing) deste user+reason?
  try {
    const existing = await col
      .where("userId", "==", userId)
      .where("reason", "==", reason)
      .where("status", "in", ["open", "reviewing"])
      .limit(1)
      .get();

    if (!existing.empty) {
      // Já há uma flag ativa — não duplica (e não notifica de novo)
      return { created: false, id: existing.docs[0].id };
    }
  } catch (error) {
    // Falha na checagem (ex.: índice ausente) — loga e segue para criar.
    // Preferimos criar (mesmo com risco de duplicar) a perder a sinalização.
    console.warn("[createFraudFlag] checagem de duplicidade falhou:", error);
  }

  // 2. Cria a flag
  const data: Record<string, unknown> = {
    userId,
    reason,
    description: description ?? "",
    status: "open",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (relatedProductId) data.relatedProductId = relatedProductId;
  if (relatedSaleId) data.relatedSaleId = relatedSaleId;

  const ref = await col.add(data);

  // 3. Notifica admins — só quando cria flag NOVA. Fire-and-forget.
  notifyAdmins({
    title: "🚨 Nova fraude detectada",
    body: `${REASON_LABEL[reason]}: ${description}`,
    type: "fraud_flag",
    data: { flagId: ref.id, reason, userId },
  }).catch(() => {});

  return { created: true, id: ref.id };
}
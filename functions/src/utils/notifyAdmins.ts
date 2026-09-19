// ============================================
// NOTIFY ADMINS — UTILITÁRIO CENTRALIZADO (backend)
//
// Envia push para TODOS os superadmins de forma confiável.
// Fonte única de verdade: appSettings/adminConfig.superAdmins
// (não usa UIDs hardcoded).
//
// SEMPRE chamar como fire-and-forget:
//   notifyAdmins({...}).catch(() => {});
// Nunca deve derrubar a ação principal.
// ============================================

import * as admin from "firebase-admin";
import { getSuperAdminUids } from "../config/adminConfig";
import { getPushTokens } from "./pushTokens";

interface NotifyAdminsParams {
  title: string;
  body: string;
  type: string;
  data?: Record<string, string>;
}

// Tokens dos superadmins, pelo helper — que já lê da
// subcoleção privada com fallback para o campo antigo.
async function getSuperAdminTokens(uids: string[]): Promise<string[]> {
  const tokens = await getPushTokens(uids);
  return tokens.filter((t): t is string => typeof t === "string" && t.length > 0);
}

export async function notifyAdmins({
  title,
  body,
  type,
  data = {},
}: NotifyAdminsParams): Promise<void> {
  try {
    const uids = await getSuperAdminUids();
    if (uids.length === 0) {
      console.warn("[notifyAdmins] Nenhum superadmin configurado");
      return;
    }

    const tokens = await getSuperAdminTokens(uids);

    // Push (Expo) — envia em lote para todos os tokens
    if (tokens.length > 0) {
      try {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            tokens.map((token) => ({
              to: token,
              title,
              body,
              data: { type, ...data },
              sound: "default",
              priority: "high",
            }))
          ),
        });
      } catch (error) {
        console.warn("[notifyAdmins] Erro ao enviar push:", error);
      }
    } else {
      console.warn("[notifyAdmins] Nenhum pushToken de superadmin encontrado");
    }

    // In-app: cria notificação para cada superadmin
    await Promise.all(
      uids.map(async (uid) => {
        try {
          await admin.firestore().collection("notifications").add({
            userId: uid,
            type,
            message: body,
            read: false,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch {
          // ignora falha in-app individual
        }
      })
    );

    console.log(`[notifyAdmins] Notificados ${uids.length} admin(s) — ${type}`);
  } catch (error) {
    console.warn("[notifyAdmins] Erro:", error);
  }
}
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

interface NotifyAdminsParams {
  title: string;
  body: string;
  type: string;
  data?: Record<string, string>;
}

// Lê os UIDs de superadmin do appSettings/adminConfig
async function getSuperAdminUids(): Promise<string[]> {
  try {
    const snap = await admin.firestore()
      .collection("appSettings")
      .doc("adminConfig")
      .get();
    const uids = snap.data()?.superAdmins;
    if (Array.isArray(uids)) {
      return uids.filter((u): u is string => typeof u === "string" && u.length > 0);
    }
    return [];
  } catch (error) {
    console.warn("[notifyAdmins] Erro ao ler adminConfig:", error);
    return [];
  }
}

// Busca pushTokens dos superadmins
async function getSuperAdminTokens(uids: string[]): Promise<string[]> {
  const tokens: string[] = [];
  await Promise.all(
    uids.map(async (uid) => {
      try {
        const snap = await admin.firestore().collection("users").doc(uid).get();
        const token = snap.data()?.pushToken;
        if (typeof token === "string" && token.length > 0) {
          tokens.push(token);
        }
      } catch {
        // ignora token individual com erro
      }
    })
  );
  return tokens;
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
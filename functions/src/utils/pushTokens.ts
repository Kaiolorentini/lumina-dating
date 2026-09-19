// ============================================
// LUMINA — TOKENS DE PUSH
// functions/src/utils/pushTokens.ts
//
// O token vive em users/{uid}/private/push, fechado ao cliente
// nas rules. Antes ficava em users/{uid}.pushToken, num
// documento com `allow list: if isAuthenticated()` — qualquer
// conta logada varria a coleção, lia o token de qualquer pessoa
// e mandava push com o nome do Lumina. Phishing dentro do app.
//
// FALLBACK: enquanto a migração não terminar, lê o campo antigo
// se a subcoleção estiver vazia. Sem isso, todo push existente
// pararia no instante do deploy.
// O fallback sai na PARTE 6, depois de migrar e validar.
// ============================================

import * as admin from "firebase-admin";

const PRIVATE_COLLECTION = "private";
const PUSH_DOC = "push";

function privateRef(uid: string): admin.firestore.DocumentReference {
  return admin
    .firestore()
    .collection("users")
    .doc(uid)
    .collection(PRIVATE_COLLECTION)
    .doc(PUSH_DOC);
}

/**
 * Token de push do usuário, ou null.
 * Nunca lança: push é secundário e falha aqui não pode derrubar
 * a operação que o disparou.
 */
export async function getPushToken(uid: string): Promise<string | null> {
  try {
    const snap = await privateRef(uid).get();
    const token = snap.data()?.token;
    if (typeof token === "string" && token.length > 0) return token;

    // FALLBACK — remover na PARTE 6.
    const userSnap = await admin.firestore().collection("users").doc(uid).get();
    const legacy = userSnap.data()?.pushToken;
    if (typeof legacy === "string" && legacy.length > 0) {
      console.log(`[pushTokens] Usando campo legado de ${uid} — migração pendente`);
      return legacy;
    }

    return null;
  } catch (error) {
    console.warn(`[pushTokens] Falha ao ler token de ${uid}:`, error);
    return null;
  }
}

/** Tokens de vários usuários, na mesma ordem dos uids. Nulos incluídos. */
export async function getPushTokens(uids: string[]): Promise<(string | null)[]> {
  return Promise.all(uids.map((uid) => getPushToken(uid)));
}

/**
 * Grava o token. Só o Admin SDK escreve aqui — o cliente passa
 * pela CF registerPushToken (PARTE 4).
 */
export async function savePushToken(uid: string, token: string): Promise<void> {
  await privateRef(uid).set(
    {
      token,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/** Remove o token. Usado quando o Expo responde DeviceNotRegistered. */
export async function deletePushToken(uid: string): Promise<void> {
  try {
    await privateRef(uid).delete();
  } catch (error) {
    console.warn(`[pushTokens] Falha ao apagar token de ${uid}:`, error);
  }
}
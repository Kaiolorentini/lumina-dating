import * as admin from "firebase-admin";

export async function assertUserNotBlocked(uid: string): Promise<void> {
  const snap = await admin.firestore().collection("users").doc(uid).get();
  if (!snap.exists) throw new Error(`Usuário ${uid} não encontrado`);
  if (snap.data()?.isBlocked === true) {
    throw new Error(`Usuário ${uid} está bloqueado`);
  }
}
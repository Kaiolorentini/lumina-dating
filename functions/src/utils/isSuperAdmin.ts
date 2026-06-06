// ============================================
// IS SUPER ADMIN — DUPLA VALIDAÇÃO
//
// Valida:
// 1. users/{uid}.role === 'superadmin'
// 2. uid existe em appSettings/adminConfig.superAdmins
//
// Ambas precisam passar. Se qualquer uma falhar:
// throw permission-denied
// ============================================

import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

export async function assertIsSuperAdmin(uid: string): Promise<void> {
  const db = admin.firestore();

  // Busca em paralelo para performance
  const [userSnap, configSnap] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("appSettings").doc("adminConfig").get(),
  ]);

  // Validação 1 — role no documento do usuário
  const role = userSnap.data()?.role;
  if (role !== "superadmin") {
    throw new HttpsError(
      "permission-denied",
      "Acesso restrito a SuperAdmins"
    );
  }

  // Validação 2 — uid na lista de superAdmins do adminConfig
  const superAdmins: string[] = configSnap.data()?.superAdmins ?? [];
  if (!superAdmins.includes(uid)) {
    throw new HttpsError(
      "permission-denied",
      "UID não autorizado como SuperAdmin"
    );
  }
}

export async function assertIsAdmin(uid: string): Promise<void> {
  const userSnap = await admin.firestore()
    .collection("users").doc(uid).get();
  const role = userSnap.data()?.role;
  if (!["admin", "superadmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "Acesso restrito a Admins"
    );
  }
}
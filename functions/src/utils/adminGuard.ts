// ============================================
// ADMIN GUARD — HELPER CENTRALIZADO
//
// FONTE ÚNICA da validação de admin. O utils/isSuperAdmin.ts
// era uma segunda implementação, usada por uma única function
// e sem a checagem de isBlocked — foi apagado.
//
// Dupla validação, mantida:
//   1. users/{uid}.role === 'superadmin'
//   2. uid na lista de superadmins (internalConfig/admins)
//   3. conta não bloqueada
//
// A lista saiu do appSettings, que é público nas rules, para
// o internalConfig, fechado. Ver config/adminConfig.ts.
// ============================================

import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import { getSuperAdminUids, invalidateAdminConfigCache } from "../config/adminConfig";

// Reexportado para não quebrar quem já importava daqui.
export { invalidateAdminConfigCache };

// Verifica autenticação — obrigatório antes de qualquer guard
export function assertAuthenticated(uid: string | undefined): asserts uid is string {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }
}

// Dupla validação de SuperAdmin
// 1. role === 'superadmin' no Firestore
// 2. uid na lista de superadmins
// 3. conta não bloqueada
export async function assertSuperAdmin(uid: string): Promise<void> {
  const [userSnap, superAdmins] = await Promise.all([
    admin.firestore().collection("users").doc(uid).get(),
    getSuperAdminUids(),
  ]);

  const role = userSnap.data()?.role;

  if (role !== "superadmin") {
    throw new HttpsError(
      "permission-denied",
      "Acesso restrito a SuperAdmins"
    );
  }

  if (!superAdmins.includes(uid)) {
    throw new HttpsError(
      "permission-denied",
      "UID não autorizado como SuperAdmin"
    );
  }

  if (userSnap.data()?.isBlocked === true) {
    throw new HttpsError(
      "permission-denied",
      "Conta bloqueada"
    );
  }
}

// Validação de Admin (admin ou superadmin)
// Usado apenas para operações de leitura — nunca para operações financeiras
export async function assertAdmin(uid: string): Promise<void> {
  const userSnap = await admin.firestore()
    .collection("users").doc(uid).get();
  const role = userSnap.data()?.role;
  if (!["admin", "superadmin"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "Acesso restrito a Admins"
    );
  }
  if (userSnap.data()?.isBlocked === true) {
    throw new HttpsError("permission-denied", "Conta bloqueada");
  }
}

// Helper para verificar se é superadmin (sem throw — retorna boolean)
export async function isSuperAdmin(uid: string): Promise<boolean> {
  try {
    await assertSuperAdmin(uid);
    return true;
  } catch {
    return false;
  }
}
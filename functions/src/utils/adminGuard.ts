// ============================================
// ADMIN GUARD — HELPER CENTRALIZADO
//
// Cache de 60s para evitar leituras excessivas.
// Dupla validação:
//   1. users/{uid}.role === 'superadmin'
//   2. uid em appSettings/adminConfig.superAdmins
// ============================================

import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

interface AdminConfig {
  superAdmins: string[];
}

// Cache local com TTL de 60 segundos
let cachedConfig: AdminConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000;

async function getAdminConfig(): Promise<AdminConfig> {
  const now = Date.now();
  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedConfig;
  }
  const snap = await admin.firestore()
    .collection("appSettings")
    .doc("adminConfig")
    .get();
  cachedConfig = {
    superAdmins: snap.data()?.superAdmins ?? [],
  };
  cacheTimestamp = now;
  return cachedConfig;
}

export function invalidateAdminConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

// Verifica autenticação — obrigatório antes de qualquer guard
export function assertAuthenticated(uid: string | undefined): asserts uid is string {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }
}

// Dupla validação de SuperAdmin
// 1. role === 'superadmin' no Firestore
// 2. uid no array appSettings/adminConfig.superAdmins
export async function assertSuperAdmin(uid: string): Promise<void> {
  const [userSnap, config] = await Promise.all([
    admin.firestore().collection("users").doc(uid).get(),
    getAdminConfig(),
  ]);

  const role = userSnap.data()?.role;

  if (role !== "superadmin") {
    throw new HttpsError(
      "permission-denied",
      "Acesso restrito a SuperAdmins"
    );
  }

  if (!config.superAdmins.includes(uid)) {
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
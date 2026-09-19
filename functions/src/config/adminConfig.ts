// ============================================
// LUMINA — LISTA DE SUPERADMINS
// functions/src/config/adminConfig.ts
//
// Fonte única. Antes cada arquivo lia
// appSettings/adminConfig direto, e o appSettings tem
// `allow read: if true` nas rules — QUALQUER PESSOA, até sem
// login, descobria quem são os superadmins do Lumina e depois
// lia o pushToken deles pela coleção users. O alvo mais
// valioso do sistema estava público.
//
// Agora vive em internalConfig/admins, fechado nos dois
// sentidos nas rules. Só o Admin SDK acessa.
//
// O fallback para appSettings/adminConfig foi removido na
// etapa B, depois de confirmado que o painel abre lendo o
// caminho novo. Para alterar a lista, editar pelo console.
// ============================================

import * as admin from "firebase-admin";

const CONFIG_PATH = { collection: "internalConfig", doc: "admins" };

// Cache de 60s — mesma janela do adminGuard, que já usava
// cache próprio. Sem ele, cada checagem custa uma leitura.
let cachedUids: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000;

function sanitize(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((u): u is string => typeof u === "string" && u.length > 0);
}

/**
 * UIDs de superadmin. Nunca lança: falha aqui devolve lista
 * vazia, e lista vazia NEGA acesso — falha fechada.
 */
export async function getSuperAdminUids(): Promise<string[]> {
  const now = Date.now();
  if (cachedUids && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedUids;
  }

  const db = admin.firestore();

  try {
    const snap = await db
      .collection(CONFIG_PATH.collection)
      .doc(CONFIG_PATH.doc)
      .get();
    const uids = sanitize(snap.data()?.superAdmins);

    if (uids.length > 0) {
      cachedUids = uids;
      cacheTimestamp = now;
      return uids;
    }

    // Lista vazia NEGA acesso a todo mundo — falha fechada.
    // Se isto aparecer no log, o documento internalConfig/admins
    // sumiu ou foi editado errado.
    console.error(
      "[adminConfig] NENHUM superadmin em internalConfig/admins — painel inacessível",
    );
    return [];
  } catch (error) {
    console.error("[adminConfig] Falha ao ler a lista de superadmins:", error);
    // NÃO cacheia o erro: a próxima chamada tenta de novo.
    return [];
  }
}

export function invalidateAdminConfigCache(): void {
  cachedUids = null;
  cacheTimestamp = 0;
}
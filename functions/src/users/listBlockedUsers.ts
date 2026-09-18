// ============================================
// LUMINA — FILA DE BLOQUEADOS POR FRAUDE
// functions/src/users/listBlockedUsers.ts
//
// Lista quem foi punido pela tela de fraudes
// (blockedSource === 'fraud').
//
// É uma CF e não uma query do cliente porque o
// documento users guarda email, pushToken e outros
// campos que não devem sair do servidor. Aqui só
// trafegam os campos que a tela usa.
//
// ÍNDICE NECESSÁRIO: blockedSource (==) + blockedAt (desc).
// Índice composto NÃO é automático — ver instruções de
// deploy. Sem ele a query falha com failed-precondition
// e o console do Firebase mostra um link que cria o índice.
// ============================================

import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";

const PAGE_LIMIT = 50;

interface BlockedUserRow {
  uid: string;
  name: string | null;
  role: string;
  previousRole: string | null;
  blockedReason: string | null;
  blockedAt: string | null;
  blockedBy: string | null;
  marketplaceBanUntil: string | null;
  /** true quando o prazo já venceu e a restauração ainda não rodou. */
  expired: boolean;
}

interface ListBlockedResult {
  users: BlockedUserRow[];
}

function toIso(value: unknown): string | null {
  const ts = value as admin.firestore.Timestamp | undefined;
  if (!ts || typeof ts.toDate !== "function") return null;
  return ts.toDate().toISOString();
}

export const listBlockedUsers = onCall<void, Promise<ListBlockedResult>>(
  async (request) => {
    assertAuthenticated(request.auth?.uid);
    await assertSuperAdmin(request.auth!.uid);

    const snap = await admin
      .firestore()
      .collection("users")
      .where("blockedSource", "==", "fraud")
      .orderBy("blockedAt", "desc")
      .limit(PAGE_LIMIT)
      .get();

    const now = Date.now();

    const users: BlockedUserRow[] = snap.docs
      // isBlocked false com blockedSource presente não deveria
      // existir, mas filtrar aqui evita mostrar quem já foi
      // liberado caso algum campo fique órfão.
      .filter((doc) => doc.data().isBlocked === true)
      .map((doc) => {
        const data = doc.data();
        const until = data.marketplaceBanUntil as admin.firestore.Timestamp | undefined;
        const untilMs =
          until && typeof until.toMillis === "function" ? until.toMillis() : null;

        return {
          uid: doc.id,
          name: typeof data.name === "string" ? data.name : null,
          role: typeof data.role === "string" ? data.role : "user",
          previousRole: typeof data.previousRole === "string" ? data.previousRole : null,
          blockedReason: typeof data.blockedReason === "string" ? data.blockedReason : null,
          blockedAt: toIso(data.blockedAt),
          blockedBy: typeof data.blockedBy === "string" ? data.blockedBy : null,
          marketplaceBanUntil: toIso(data.marketplaceBanUntil),
          expired: untilMs !== null && untilMs <= now,
        };
      });

    console.log(`[listBlockedUsers] ${users.length} bloqueados por fraude`);

    return { users };
  }
);
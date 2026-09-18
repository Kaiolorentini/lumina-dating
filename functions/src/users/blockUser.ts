import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated, assertSuperAdmin } from "../utils/adminGuard";
import { createAuditLog } from "../utils/auditLog";
import { notifyUser } from "../utils/notifyUser";
import { isValidBanDuration } from "../utils/marketplaceBan";

export const blockUser = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const safeUid: string = request.auth!.uid;

  await assertSuperAdmin(safeUid);

  const { userId, reason, banHours, source } = request.data as {
    userId: string;
    reason?: string;
    /** 24, 48 ou 72. Ausente/null = bloqueio indefinido (comportamento antigo). */
    banHours?: number | null;
    /** Origem da punição. Só 'fraud' aparece na aba de bloqueados. */
    source?: "fraud" | "admin";
  };
  if (!userId) throw new HttpsError("invalid-argument", "userId obrigatório");
  if (userId === safeUid) throw new HttpsError("invalid-argument", "Não é possível bloquear a si mesmo");

  const blockedSource: "fraud" | "admin" = source === "fraud" ? "fraud" : "admin";

  const hasDuration = banHours !== undefined && banHours !== null;
  if (hasDuration && !isValidBanDuration(banHours)) {
    throw new HttpsError("invalid-argument", "banHours deve ser 24, 48 ou 72");
  }

  const userRef = admin.firestore().collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError("not-found", "Usuário não encontrado");

  const userData = userSnap.data() ?? {};
  const oldRole = userData.role;

  // Bloquear um admin o tranca fora do painel: o assertSuperAdmin
  // recusa conta bloqueada E exige role 'superadmin', que o
  // rebaixamento abaixo derruba. Só daria para desfazer editando
  // o Firestore no console.
  //
  // Se um admin agir mal, o caminho é remover o papel dele —
  // nunca bloquear.
  if (oldRole === "admin" || oldRole === "superadmin") {
    throw new HttpsError(
      "failed-precondition",
      "Não é possível bloquear um administrador. Remova o papel antes.",
    );
  }

  const patch: Record<string, unknown> = {
    isBlocked: true,
    blockedReason: reason ?? "Bloqueado pelo administrador",
    blockedAt: admin.firestore.FieldValue.serverTimestamp(),
    blockedBy: safeUid,
    blockedSource,
  };

  // Rebaixa o papel: sem 'creator' o app não mostra as telas
  // de criador. O papel volta na restauração.
  //
  // previousRole só é gravado se AINDA NÃO existe — bloquear
  // duas vezes seguidas gravaria previousRole: 'user' e o
  // papel de criador se perderia para sempre.
  const alreadyHasPrevious = typeof userData.previousRole === "string";
  if (!alreadyHasPrevious && typeof oldRole === "string" && oldRole !== "user") {
    patch.previousRole = oldRole;
  }
  if (oldRole === "creator") {
    patch.role = "user";
  }

  let untilDate: Date | null = null;
  if (hasDuration) {
    untilDate = new Date(Date.now() + (banHours as number) * 3600000);
    patch.marketplaceBanUntil = admin.firestore.Timestamp.fromDate(untilDate);
  } else {
    // Indefinido: nenhum prazo gravado, e a restauração
    // automática ignora quem não tem marketplaceBanUntil.
    patch.marketplaceBanUntil = admin.firestore.FieldValue.delete();
  }

  await userRef.update(patch);

  await createAuditLog({
    action: "user_blocked",
    performedBy: safeUid,
    targetId: userId,
    targetType: "user",
    metadata: {
      reason,
      oldRole,
      userName: userData.name,
      banHours: hasDuration ? banHours : null,
      marketplaceBanUntil: untilDate ? untilDate.toISOString() : null,
      roleDowngraded: oldRole === "creator",
    },
    req: request.rawRequest,
  });

  // Push DEPOIS da escrita: notifyUser engole erros, mas
  // uma falha de push não pode desfazer a punição.
  const untilText = untilDate
    ? untilDate.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  await notifyUser({
    userId,
    title: "🚫 Acesso ao Marketplace suspenso",
    body: untilText
      ? `Seu acesso ao Marketplace foi suspenso até ${untilText}. Motivo: ${reason ?? "violação dos termos"}.`
      : `Seu acesso ao Marketplace foi suspenso. Motivo: ${reason ?? "violação dos termos"}. Entre em contato com o suporte.`,
    type: "marketplace_banned",
    data: { banHours: hasDuration ? String(banHours) : "indefinido" },
  });

  return {
    success: true,
    marketplaceBanUntil: untilDate ? untilDate.toISOString() : null,
    roleDowngraded: oldRole === "creator",
  };
});
// ============================================
// LUMINA — BAN TEMPORÁRIO DE MARKETPLACE
// functions/src/utils/marketplaceBan.ts
//
// Punição por fraude aplicada pelo painel de fraudes:
//   1. isBlocked: true            → esconde o Marketplace
//   2. role: creator → user       → perde telas de criador
//   3. previousRole               → guarda o papel para restaurar
//   4. marketplaceBanUntil        → quando expira (ou ausente = indefinido)
//
// O ban expira por COMPARAÇÃO DE TIMESTAMP — não existe
// processo que "libera" no segundo exato. A restauração
// acontece sob demanda (restoreCreatorIfExpired, chamada
// pelo app) e uma varredura diária cobre quem não abriu
// o app (expireMarketplaceBans).
//
// Esconder tela NÃO é bloqueio: as CFs de compra, saque e
// criação de produto precisam chamar assertMarketplaceNotBanned.
// ============================================

import * as admin from "firebase-admin";

/** Durações aceitas pelo painel de fraudes. null = indefinido. */
export const BAN_DURATIONS_HOURS = [24, 48, 72] as const;
export type BanDurationHours = typeof BAN_DURATIONS_HOURS[number];

export function isValidBanDuration(value: unknown): value is BanDurationHours {
  return typeof value === "number" &&
    (BAN_DURATIONS_HOURS as readonly number[]).includes(value);
}

/**
 * Restaura o papel anterior e limpa os campos do ban.
 * Devolve o patch a aplicar, ou null se não havia nada a restaurar.
 *
 * ORDEM IMPORTA: o previousRole é LIDO e aplicado no mesmo
 * patch que o apaga — apagar antes perderia o papel.
 */
export function buildRestorePatch(
  data: admin.firestore.DocumentData | undefined
): Record<string, unknown> | null {
  if (!data) return null;

  const until = data.marketplaceBanUntil as admin.firestore.Timestamp | undefined;

  // Sem prazo gravado = ban indefinido ou nenhum ban.
  // Nunca restaurado automaticamente: só o admin remove.
  if (!until || typeof until.toMillis !== "function") return null;

  if (until.toMillis() > Date.now()) return null; // ainda ativo

  const patch: Record<string, unknown> = {
    isBlocked: false,
    marketplaceBanUntil: admin.firestore.FieldValue.delete(),
    previousRole: admin.firestore.FieldValue.delete(),
    blockedReason: admin.firestore.FieldValue.delete(),
    blockedAt: admin.firestore.FieldValue.delete(),
    blockedBy: admin.firestore.FieldValue.delete(),
    blockedSource: admin.firestore.FieldValue.delete(),
    marketplaceBanRestoredAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Só devolve o papel se ele foi rebaixado por esta punição.
  // Guardar 'user' como previousRole não reescreve nada.
  const previousRole = data.previousRole;
  if (typeof previousRole === "string" && previousRole !== "user") {
    patch.role = previousRole;
  }

  return patch;
}
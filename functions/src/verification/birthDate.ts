// ============================================
// LUMINA — DATA DE NASCIMENTO E IDADE (verificação)
// functions/src/verification/birthDate.ts
//
// Saiu de approveAgeVerification.ts (12/10/2026) para ser usado
// também na recusa: o encerramento por menoridade (UNDERAGE) só
// acontece se a data digitada pelo admin confirmar menos de 18 anos.
// ============================================

import { HttpsError } from "firebase-functions/v2/https";

/**
 * Idade em anos completos, calculada em America/Sao_Paulo.
 * Nunca usar toISOString() para isto: em BRT ele muda o dia
 * antes da meia-noite local e alguém aniversariando hoje
 * poderia contar um ano a menos.
 */
export function ageInBrt(birthDate: Date): number {
  const nowBrt = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );

  let age = nowBrt.getFullYear() - birthDate.getFullYear();
  const monthDiff = nowBrt.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && nowBrt.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

/** AAAA-MM-DD → Date local. Recusa data inexistente, futura ou improvável. */
export function parseBirthDate(raw: unknown): Date {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new HttpsError(
      "invalid-argument",
      "Digite a data de nascimento do documento no formato DD/MM/AAAA.",
    );
  }

  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  // Rejeita data inexistente (31/02 vira 03/03 no construtor).
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new HttpsError("invalid-argument", "Data de nascimento inválida");
  }

  if (date.getTime() > Date.now()) {
    throw new HttpsError("invalid-argument", "Data de nascimento no futuro");
  }

  // 120 anos: erro de digitação no ano, não pessoa centenária.
  if (year < new Date().getFullYear() - 120) {
    throw new HttpsError("invalid-argument", "Data de nascimento improvável — confira o ano");
  }

  return date;
}

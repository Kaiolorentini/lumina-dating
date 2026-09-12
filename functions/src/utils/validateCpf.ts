// ============================================
// LUMINA — VALIDAÇÃO DE CPF (BACKEND)
// functions/src/utils/validateCpf.ts
//
// Espelha src/utils/cpf.ts do app, mas é a validação que
// vale: o cliente pode ser modificado, a CF não.
//
// Roda ANTES de chamar o Asaas — um CPF com dígito errado
// gastaria uma chamada externa para receber 400.
// ============================================

import { HttpsError } from "firebase-functions/v2/https";

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== parseInt(cpf[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== parseInt(cpf[10], 10)) return false;

  return true;
}

/**
 * Normaliza e valida o CPF recebido do cliente.
 *
 * O CPF NUNCA deve ser gravado no Firestore nem entrar em
 * logs de auditoria — ele existe apenas no escopo desta
 * invocação, a caminho do Asaas.
 */
export function assertValidCpf(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new HttpsError("invalid-argument", "CPF é obrigatório para gerar a cobrança.");
  }
  const digits = onlyDigits(raw);
  if (!isValidCpf(digits)) {
    throw new HttpsError("invalid-argument", "CPF inválido.");
  }
  return digits;
}
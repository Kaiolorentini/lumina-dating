// ============================================
// LUMINA — UTILITÁRIOS DE CPF
// src/utils/cpf.ts
//
// Extraído de useProfileSetup.ts (v5.x), onde o CPF era
// persistido no perfil. Desde a migração para cobrança
// sem armazenamento, o CPF só existe em memória durante
// o fluxo de pagamento — estas funções são o único
// ponto de máscara e validação do app.
// ============================================

/** Remove tudo que não for dígito. */
export function onlyDigits(v: string): string {
  return v.replace(/\D/g, '');
}

/** Aplica máscara 000.000.000-00 conforme o usuário digita. */
export function maskCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Valida os dígitos verificadores do CPF.
 *
 * Validar no cliente evita uma ida ao Asaas que falharia
 * com "CPF inválido" — mas NÃO é garantia de segurança:
 * a Cloud Function revalida antes de criar a cobrança.
 */
export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos os dígitos iguais

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
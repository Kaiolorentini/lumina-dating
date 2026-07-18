// ============================================
// SAVE CREATOR PIX KEY — recebimento via saque manual
//
// Callable — nunca direto do app.
// O criador informa a CHAVE PIX onde quer receber os saques.
// O admin transfere manualmente e marca o saque como pago.
//
// NÃO chama a API do Asaas (modelo de saque manual).
// Valida o FORMATO da chave conforme o tipo escolhido.
//
// ⚠️ A validação de FORMATO evita erro de digitação, mas NÃO
// confirma titularidade. O admin deve conferir os dados do
// criador antes de transferir (proteção anti-golpe real).
// ============================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { assertAuthenticated } from "../utils/adminGuard";
import { assertUserNotBlocked } from "../utils/assertUserNotBlocked";
import { createAuditLog } from "../utils/auditLog";

type PixKeyType = "cpf" | "email" | "phone" | "random";

// --- Validadores de formato por tipo ---

function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
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
  return check === parseInt(cpf[10], 10);
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isValidPhone(v: string): boolean {
  // BR: 10 ou 11 dígitos (DDD + número). Aceita com/sem +55.
  const digits = v.replace(/\D/g, "").replace(/^55/, "");
  return digits.length === 10 || digits.length === 11;
}

function isValidRandomKey(v: string): boolean {
  // Chave aleatória Pix = UUID
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
}

// Normaliza a chave para armazenamento (padrão consistente)
function normalizePixKey(type: PixKeyType, raw: string): string {
  const v = raw.trim();
  switch (type) {
    case "cpf": return v.replace(/\D/g, "");
    case "phone": {
      const digits = v.replace(/\D/g, "").replace(/^55/, "");
      return `+55${digits}`;
    }
    case "email": return v.toLowerCase();
    case "random": return v.toLowerCase();
    default: return v;
  }
}

function validateByType(type: PixKeyType, raw: string): boolean {
  switch (type) {
    case "cpf": return isValidCpf(raw);
    case "email": return isValidEmail(raw);
    case "phone": return isValidPhone(raw);
    case "random": return isValidRandomKey(raw);
    default: return false;
  }
}

const TYPE_ERROR: Record<PixKeyType, string> = {
  cpf: "CPF inválido. Verifique os números.",
  email: "E-mail inválido.",
  phone: "Telefone inválido. Use DDD + número.",
  random: "Chave aleatória inválida (deve ser um código no formato UUID).",
};

export const saveCreatorPixKey = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  await assertUserNotBlocked(uid);

  const { pixKey, pixKeyType } = request.data as {
    pixKey: string;
    pixKeyType: PixKeyType;
  };

  if (!pixKey?.trim()) {
    throw new HttpsError("invalid-argument", "Informe sua chave Pix.");
  }
  const validTypes: PixKeyType[] = ["cpf", "email", "phone", "random"];
  if (!validTypes.includes(pixKeyType)) {
    throw new HttpsError("invalid-argument", "Tipo de chave Pix inválido.");
  }

  if (!validateByType(pixKeyType, pixKey)) {
    throw new HttpsError("invalid-argument", TYPE_ERROR[pixKeyType]);
  }

  const normalized = normalizePixKey(pixKeyType, pixKey);

  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Usuário não encontrado.");
  }

  await userRef.update({
    pixKey: normalized,
    pixKeyType,
    pixKeyVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    // status usado pela tela para mostrar "configurado"
    paymentSetupStatus: "configured",
  });

  createAuditLog({
    action: "pix_key_saved",
    performedBy: uid,
    targetId: uid,
    targetType: "user",
    metadata: { pixKeyType },
    req: request.rawRequest,
  }).catch(() => {});

  return {
    valid: true,
    pixKeyType,
    // devolve mascarado para a tela confirmar (não expõe a chave completa em logs)
    maskedKey: normalized.length > 4
      ? `${normalized.slice(0, 3)}***${normalized.slice(-2)}`
      : "***",
  };
});
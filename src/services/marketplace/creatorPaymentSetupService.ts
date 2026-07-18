// ============================================
// CREATOR PAYMENT SETUP SERVICE — chave Pix (saque manual)
//
// O criador informa a chave Pix onde recebe os saques.
// Validação de formato + persistência via Cloud Function
// (saveCreatorPixKey). NÃO usa API do Asaas.
// ============================================

import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../core/firebase';
import app from '../../core/firebase';
import { COLLECTIONS } from '../../core/constants';

export type PixKeyType = 'cpf' | 'email' | 'phone' | 'random';

export interface SavePixKeyResult {
  valid: boolean;
  error?: string;
  maskedKey?: string;
}

// ============================================
// Validação de formato local (feedback rápido antes de enviar)
// ============================================
export function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '');
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

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function isValidPhone(v: string): boolean {
  const digits = v.replace(/\D/g, '').replace(/^55/, '');
  return digits.length === 10 || digits.length === 11;
}

export function isValidRandomKey(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
}

export function validatePixKeyFormat(type: PixKeyType, value: string): boolean {
  switch (type) {
    case 'cpf': return isValidCpf(value);
    case 'email': return isValidEmail(value);
    case 'phone': return isValidPhone(value);
    case 'random': return isValidRandomKey(value);
    default: return false;
  }
}

// ============================================
// Salva a chave Pix via Cloud Function
// ============================================
export async function saveCreatorPixKey(
  pixKey: string,
  pixKeyType: PixKeyType,
): Promise<SavePixKeyResult> {
  if (!validatePixKeyFormat(pixKeyType, pixKey)) {
    return { valid: false, error: 'Formato de chave Pix inválido para o tipo escolhido.' };
  }

  try {
    const functions = getFunctions(app, 'us-central1');
    const fn = httpsCallable(functions, 'saveCreatorPixKey');
    const result = await fn({ pixKey: pixKey.trim(), pixKeyType }) as {
      data: { valid: boolean; maskedKey?: string };
    };
    return { valid: result.data.valid, maskedKey: result.data.maskedKey };
  } catch (error: any) {
    const code: string = error?.code ?? '';
    if (code === 'functions/invalid-argument') {
      return { valid: false, error: error.message ?? 'Chave Pix inválida.' };
    }
    if (code === 'functions/permission-denied') {
      return { valid: false, error: 'Conta bloqueada ou sem permissão.' };
    }
    return { valid: false, error: error.message ?? 'Erro ao salvar chave Pix.' };
  }
}

// ============================================
// Lê a configuração atual de recebimento do criador
// ============================================
export async function getPixKeyStatus(uid: string): Promise<{
  configured: boolean;
  pixKeyType?: PixKeyType;
  maskedKey?: string;
}> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    if (!snap.exists()) return { configured: false };
    const data = snap.data();
    if (!data.pixKey) return { configured: false };
    const key: string = data.pixKey;
    return {
      configured: true,
      pixKeyType: data.pixKeyType as PixKeyType,
      maskedKey: key.length > 4 ? `${key.slice(0, 3)}***${key.slice(-2)}` : '***',
    };
  } catch {
    return { configured: false };
  }
}
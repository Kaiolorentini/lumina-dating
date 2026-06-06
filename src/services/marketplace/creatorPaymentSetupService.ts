// ============================================
// CREATOR PAYMENT SETUP SERVICE — MARKETPLACE
//
// Responsabilidades:
// - Validar formato do Wallet ID
// - Salvar Wallet ID no Firestore
// - Verificar conta Asaas (MVP: formato apenas)
//
// ⚠️ API_TODO #1:
// Quando tiver API Key do Asaas, substituir
// validateWalletIdFormat() por chamada real:
// GET https://sandbox.asaas.com/api/v3/accounts/{walletId}
// Header: access_token: ASAAS_API_KEY
// Se retornar 200 → conta existe e está ativa
// Se retornar 404 → wallet não encontrado
// ============================================

import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { COLLECTIONS } from '../../core/constants';
import { AsaasAccountStatus } from '../../shared/types/marketplace';

// Regex UUID v4 — formato esperado do Wallet ID Asaas
const WALLET_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valida apenas o formato do Wallet ID
export function validateWalletIdFormat(walletId: string): boolean {
  return WALLET_ID_REGEX.test(walletId.trim());
}

// ============================================
// ⚠️ API_TODO #2:
// Substituir esta função quando tiver API Key:
//
// export async function verifyWalletWithAsaas(
//   walletId: string
// ): Promise<{ valid: boolean; accountName?: string }> {
//   const response = await fetch(
//     `https://sandbox.asaas.com/api/v3/accounts/${walletId}`,
//     { headers: { access_token: ASAAS_API_KEY } }
//   );
//   if (response.ok) {
//     const data = await response.json();
//     return { valid: true, accountName: data.name };
//   }
//   return { valid: false };
// }
//
// Em produção trocar URL para:
// https://api.asaas.com/api/v3/accounts/{walletId}
// ============================================

export interface VerifyWalletResult {
  valid: boolean;
  error?: string;
  accountName?: string;
}

// MVP: valida formato apenas — sem chamada real à API
// FASE 6B: substituir pelo TODO #2 acima
export async function verifyWalletId(
  walletId: string
): Promise<VerifyWalletResult> {
  const trimmed = walletId.trim();

  if (!trimmed) {
    return { valid: false, error: 'Informe o Wallet ID' };
  }

  if (!validateWalletIdFormat(trimmed)) {
    return {
      valid: false,
      error: 'Formato inválido. O Wallet ID deve ter o formato:\nxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    };
  }

  // ⚠️ API_TODO #3:
  // Aqui chamar verifyWalletWithAsaas(trimmed)
  // e retornar { valid: false, error: 'Conta não encontrada' }
  // se a API retornar 404

  // MVP: formato válido = aceito como pending
  return { valid: true };
}

// Salva Wallet ID no Firestore com status pending
export async function saveWalletId(
  uid: string,
  walletId: string
): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(userRef, {
    asaasWalletId: walletId.trim(),
    asaasAccountVerified: false,
    asaasAccountStatus: 'pending' as AsaasAccountStatus,
    asaasAccountType: 'cpf',
  });
}

// Marca conta como verificada após confirmação real da API
// ⚠️ API_TODO #4:
// Esta função será chamada após verifyWalletWithAsaas() retornar valid: true
// Trocar asaasAccountStatus para 'verified' quando API confirmar
export async function markWalletVerified(
  uid: string,
  walletId: string
): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(userRef, {
    asaasWalletId: walletId.trim(),
    asaasAccountVerified: true,
    asaasAccountVerifiedAt: new Date(),
    asaasAccountStatus: 'verified' as AsaasAccountStatus,
    asaasAccountType: 'cpf',
  });
}

// Marca erro na verificação
export async function markWalletError(uid: string): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(userRef, {
    asaasAccountVerified: false,
    asaasAccountStatus: 'error' as AsaasAccountStatus,
  });
}

// Busca status atual da conta Asaas do criador
export async function getAsaasStatus(uid: string): Promise<{
  status: AsaasAccountStatus;
  walletId?: string;
}> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    if (!snap.exists()) return { status: 'not_configured' };
    const data = snap.data();
    return {
      status: (data.asaasAccountStatus as AsaasAccountStatus) ?? 'not_configured',
      walletId: data.asaasWalletId,
    };
  } catch {
    return { status: 'not_configured' };
  }
}
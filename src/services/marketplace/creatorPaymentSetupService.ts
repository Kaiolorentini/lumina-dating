// ============================================
// CREATOR PAYMENT SETUP SERVICE — MARKETPLACE
//
// verifyAsaasWalletViaApi → Cloud Function
// (cache 24h, validação real Asaas)
// ============================================

import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../core/firebase';
import app from '../../core/firebase';
import { COLLECTIONS } from '../../core/constants';
import { AsaasAccountStatus } from '../../shared/types/marketplace';

const WALLET_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateWalletIdFormat(walletId: string): boolean {
  return WALLET_ID_REGEX.test(walletId.trim());
}

export interface VerifyWalletResult {
  valid: boolean;
  error?: string;
  accountName?: string;
  cached?: boolean;
}

// ============================================
// Verifica formato apenas (sem API)
// Mantido para compatibilidade
// ============================================
export async function verifyWalletId(
  walletId: string
): Promise<VerifyWalletResult> {
  const trimmed = walletId.trim();
  if (!trimmed) return { valid: false, error: 'Informe o Wallet ID' };
  if (!validateWalletIdFormat(trimmed)) {
    return {
      valid: false,
      error: 'Formato inválido. O Wallet ID deve ter o formato:\nxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    };
  }
  return { valid: true };
}

// ============================================
// Verifica via Cloud Function (Asaas real)
// Cache de 24h na Cloud Function
// ============================================
export async function verifyAsaasWalletViaApi(
  walletId: string
): Promise<VerifyWalletResult> {
  // Validar formato antes de chamar a API
  const formatCheck = await verifyWalletId(walletId);
  if (!formatCheck.valid) return formatCheck;

  try {
    const functions = getFunctions(app, 'us-central1');
    const fn = httpsCallable(functions, 'verifyAsaasWallet');
    const result = await fn({ walletId: walletId.trim() }) as {
      data: {
        valid: boolean;
        accountName?: string;
        cached?: boolean;
        status: string;
      };
    };

    return {
      valid: result.data.valid,
      accountName: result.data.accountName,
      cached: result.data.cached,
    };
  } catch (error: any) {
    const code: string = error?.code ?? '';

    if (code === 'functions/not-found') {
      return {
        valid: false,
        error: 'Wallet ID não encontrado no Asaas. Verifique se o ID está correto.',
      };
    }
    if (code === 'functions/invalid-argument') {
      return {
        valid: false,
        error: error.message ?? 'Wallet ID inválido.',
      };
    }
    if (code === 'functions/permission-denied') {
      return {
        valid: false,
        error: 'Conta bloqueada ou sem permissão.',
      };
    }
    if (code === 'functions/unavailable' || code === 'functions/internal') {
      return {
        valid: false,
        error: 'Serviço temporariamente indisponível. Tente novamente.',
      };
    }

    return {
      valid: false,
      error: error.message ?? 'Erro ao verificar conta Asaas.',
    };
  }
}

// ============================================
// Salva Wallet ID como pending (legado)
// ============================================
export async function saveWalletId(uid: string, walletId: string): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(userRef, {
    asaasWalletId: walletId.trim(),
    asaasAccountVerified: false,
    asaasAccountStatus: 'pending' as AsaasAccountStatus,
    asaasAccountType: 'cpf',
  });
}

// ============================================
// Marca como verificado (usado pela CF)
// ============================================
export async function markWalletVerified(uid: string, walletId: string): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(userRef, {
    asaasWalletId: walletId.trim(),
    asaasAccountVerified: true,
    asaasAccountVerifiedAt: new Date(),
    asaasAccountStatus: 'verified' as AsaasAccountStatus,
    asaasAccountType: 'cpf',
  });
}

export async function markWalletError(uid: string): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(userRef, {
    asaasAccountVerified: false,
    asaasAccountStatus: 'error' as AsaasAccountStatus,
  });
}

export async function getAsaasStatus(uid: string): Promise<{
  status: AsaasAccountStatus;
  walletId?: string;
  accountName?: string;
}> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    if (!snap.exists()) return { status: 'not_configured' };
    const data = snap.data();
    return {
      status: (data.asaasAccountStatus as AsaasAccountStatus) ?? 'not_configured',
      walletId: data.asaasWalletId,
      accountName: data.asaasAccountName,
    };
  } catch {
    return { status: 'not_configured' };
  }
}
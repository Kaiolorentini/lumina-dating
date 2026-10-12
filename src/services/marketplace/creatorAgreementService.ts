// ============================================
// LUMINA — CONTRATO DO CRIADOR E DECLARAÇÃO DO PRODUTO (APP)
// src/services/marketplace/creatorAgreementService.ts
//
// 12/10/2026.
// • Situação do contrato: lida em creatorAgreements/{uid} (o criador
//   só lê; quem grava é a CF acceptCreatorContract).
// • Aceite do contrato: CF acceptCreatorContract.
// • A declaração do produto vai junto do envio (productService).
// • Versão do app e plataforma acompanham cada aceite como prova.
// ============================================

import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import app, { db } from '../../core/firebase';
import { CREATOR_CONTRACT_VERSION } from '../../config/legal/creatorAgreement';

export interface AcceptanceMeta {
  appVersion: string | null;
  platform: string;
}

/** Enviado em todo aceite: o servidor grava junto da prova. */
export function acceptanceMeta(): AcceptanceMeta {
  return {
    appVersion: Constants.expoConfig?.version ?? null,
    platform: Platform.OS,
  };
}

/** true se o criador já aceitou a versão VIGENTE do contrato. */
export async function hasAcceptedCurrentContract(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'creatorAgreements', uid));
  return snap.exists() && snap.data()?.contractVersion === CREATOR_CONTRACT_VERSION;
}

export async function acceptCreatorContract(): Promise<void> {
  const fn = httpsCallable<{ version: string } & AcceptanceMeta, { success: boolean }>(
    getFunctions(app, 'us-central1'), 'acceptCreatorContract',
  );
  await fn({ version: CREATOR_CONTRACT_VERSION, ...acceptanceMeta() });
}

/** Código do erro das CFs (HttpsError details.code). */
function errorCode(error: unknown): string | null {
  const details = (error as { details?: unknown } | null)?.details;
  if (details && typeof details === 'object' && typeof (details as { code?: unknown }).code === 'string') {
    return (details as { code: string }).code;
  }
  return null;
}

/** O servidor recusou porque o contrato vigente não foi aceito. */
export function isContractRequiredError(error: unknown): boolean {
  return errorCode(error) === 'CONTRACT_REQUIRED';
}

export function agreementErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Não foi possível concluir agora. Tente de novo.';
}

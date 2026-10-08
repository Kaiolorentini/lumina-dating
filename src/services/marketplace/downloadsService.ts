// ============================================
// DOWNLOADS SERVICE — MARKETPLACE
//
// Apenas registra log de download.
// Geração de signed URL é Cloud Function (FASE 6).
// ============================================

import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS } from '../../core/constants';
// Auditoria do app REMOVIDA (08/10/2026): o cliente gravava em
// auditLogs, que as regras fecham para o app — toda gravação era
// recusada e o erro engolido. Registro confiável só sai do servidor
// (Cloud Functions), e esses continuam funcionando.

export async function registerDownload(
  purchaseId: string,
  productId: string,
  userId: string,
  fileIndex: number,
  deviceInfo: { platform: string; model?: string; osVersion?: string },
  appVersion: string,
): Promise<void> {
  try {
    await addDoc(collection(db, MARKETPLACE_COLLECTIONS.DOWNLOADS), {
      purchaseId,
      productId,
      userId,
      fileIndex,
      deviceInfo,
      appVersion,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('[downloadsService] Erro ao registrar download:', error);
  }
}

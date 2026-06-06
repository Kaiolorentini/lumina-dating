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
import { createAuditLog } from './auditService';

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

    await createAuditLog({
      action: 'download_registered',
      performedBy: userId,
      targetId: purchaseId,
      targetType: 'product',
      metadata: { productId, fileIndex },
    });
  } catch (error) {
    // Download log não deve bloquear o acesso
    console.warn('[downloadsService] Erro ao registrar download:', error);
  }
}
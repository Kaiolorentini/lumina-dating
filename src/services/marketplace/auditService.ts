// ============================================
// AUDIT SERVICE — MARKETPLACE
//
// Registra ações auditáveis no Firestore.
// ip NÃO é coletado aqui — apenas Cloud Functions.
//
// MELHORIA FASE 3.4:
// - versão do app com fallback robusto para EAS builds
// ============================================

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS } from '../../core/constants';
import { AuditTargetType } from '../../shared/types/marketplace';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

interface AuditLogInput {
  action: string;
  performedBy: string;
  targetId: string;
  targetType: AuditTargetType;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    // MELHORIA: fallback robusto para EAS builds com runtime version fixo
    const appVersion =
      Constants.expoConfig?.version
      ?? (Constants as any).manifest?.version
      ?? 'unknown';

    const platform = Platform.OS;

    await addDoc(
      collection(db, MARKETPLACE_COLLECTIONS.AUDIT_LOGS),
      {
        action: input.action,
        performedBy: input.performedBy,
        targetId: input.targetId,
        targetType: input.targetType,
        metadata: input.metadata ?? {},
        platform,
        appVersion,
        createdAt: serverTimestamp(),
        // ip: omitido intencionalmente — apenas Cloud Functions
      }
    );
  } catch (error) {
    // Falha de auditoria não quebra o fluxo principal
    console.warn('[auditService] Erro ao registrar auditoria:', error);
  }
}
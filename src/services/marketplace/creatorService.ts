// ============================================
// CREATOR SERVICE — MARKETPLACE
//
// Gerencia solicitações para se tornar criador.
// Aprovação é responsabilidade de Cloud Function (FASE 6).
// ============================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS } from '../../core/constants';
import { createAuditLog } from './auditService';
import { notifySuperAdmins } from './pushAdminService';

export interface CreatorRequest {
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
}

// ============================================
// Busca solicitação ativa do usuário
// ============================================
export async function getCreatorRequestByUserId(
  userId: string,
): Promise<CreatorRequest | null> {
  const q = query(
    collection(db, MARKETPLACE_COLLECTIONS.CREATOR_REQUESTS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(1),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return {
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate() ?? new Date(),
    reviewedAt: d.data().reviewedAt?.toDate(),
  } as CreatorRequest;
}

// ============================================
// Cria solicitação de criador + notifica superadmins
// ============================================
export async function createCreatorRequest(userId: string): Promise<string> {
  const existing = await getCreatorRequestByUserId(userId);
  if (existing && existing.status === 'pending') {
    throw new Error('Você já tem uma solicitação pendente');
  }
  if (existing && existing.status === 'approved') {
    throw new Error('Você já é um criador aprovado');
  }

  // Operação principal — nunca deve falhar por causa de audit/notificação
  const docRef = await addDoc(
    collection(db, MARKETPLACE_COLLECTIONS.CREATOR_REQUESTS),
    {
      userId,
      status: 'pending',
      createdAt: serverTimestamp(),
    },
  );

  // Audit e notificação — fire-and-forget, nunca bloqueiam o fluxo
  createAuditLog({
    action: 'creator_request_created',
    performedBy: userId,
    targetId: docRef.id,
    targetType: 'creator',
    metadata: { userId },
  }).catch(() => { /* auditoria nunca bloqueia */ });

  notifySuperAdmins(
    '🎨 Nova solicitação de criador',
    `Usuário ${userId.slice(0, 8)}... quer se tornar criador`,
    {
      type: 'creator_request_new',
      userId,
      requestId: docRef.id,
    },
  ).catch(() => { /* notificação nunca bloqueia */ });

  return docRef.id;
}

// ============================================
// Cancela solicitação pendente
// ============================================
export async function cancelCreatorRequest(
  requestId: string,
  userId: string,
): Promise<void> {
  const requestRef = doc(db, MARKETPLACE_COLLECTIONS.CREATOR_REQUESTS, requestId);
  await updateDoc(requestRef, {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
    rejectionReason: 'Cancelado pelo usuário',
  });

  // Audit — fire-and-forget
  createAuditLog({
    action: 'creator_request_cancelled',
    performedBy: userId,
    targetId: requestId,
    targetType: 'creator',
    metadata: { userId },
  }).catch(() => { /* auditoria nunca bloqueia */ });
}

// ============================================
// Listener em tempo real para solicitação do usuário
// ============================================
export function listenToCreatorRequest(
  userId: string,
  onUpdate: (request: CreatorRequest | null) => void,
): () => void {
  const q = query(
    collection(db, MARKETPLACE_COLLECTIONS.CREATOR_REQUESTS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(1),
  );

  return onSnapshot(
    q,
    snapshot => {
      if (snapshot.empty) {
        onUpdate(null);
        return;
      }
      const d = snapshot.docs[0];
      onUpdate({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
        reviewedAt: d.data().reviewedAt?.toDate(),
      } as CreatorRequest);
    },
    error => {
      console.warn('[creatorService] Erro no listener:', error);
      onUpdate(null);
    },
  );
}
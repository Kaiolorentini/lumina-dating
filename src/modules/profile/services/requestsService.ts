import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';
import { createNotification } from '../../notifications/services/notificationService';

// ============================================
// REQUESTS SERVICE — MÓDULO PROFILE
//
// Responsabilidade única:
// Gerenciar solicitações de conexão entre usuários.
// ============================================

export type RequestStatus = 'pending' | 'accepted' | 'rejected';

export interface ConnectionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  fromUserPhoto: string;
  status: RequestStatus;
  timestamp: Date;
}

function mapRequest(d: any): ConnectionRequest {
  return {
    id: d.id,
    fromUserId: d.data().fromUserId,
    toUserId: d.data().toUserId,
    fromUserName: d.data().fromUserName,
    fromUserPhoto: d.data().fromUserPhoto,
    status: d.data().status,
    timestamp: d.data().timestamp?.toDate() || new Date(),
  };
}

// Busca solicitação entre dois usuários
export async function getSolicitacaoEntre(
  userId1: string,
  userId2: string
): Promise<ConnectionRequest | null> {
  try {
    const q = query(
      collection(db, COLLECTIONS.CONNECTION_REQUESTS),
      where('fromUserId', '==', userId1),
      where('toUserId', '==', userId2)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return mapRequest(snap.docs[0]);
  } catch {
    return null;
  }
}

// Envia solicitação
export async function enviarSolicitacao(
  fromUserId: string,
  fromUserName: string,
  fromUserPhoto: string,
  toUserId: string,
  toUserName: string
): Promise<boolean> {
  try {
    const existing = await getSolicitacaoEntre(fromUserId, toUserId);
    if (existing) return false;

    await addDoc(collection(db, COLLECTIONS.CONNECTION_REQUESTS), {
      fromUserId,
      toUserId,
      fromUserName,
      fromUserPhoto,
      status: 'pending',
      timestamp: serverTimestamp(),
    });

    // Notificação interna
    await createNotification(
      toUserId,
      'sintonia',
      `${fromUserName} quer se conectar com você! ✦`
    );

    // Push notification
    const { sendPushToUser } = await import(
      '../../notifications/services/pushService'
    );
    await sendPushToUser(
      toUserId,
      '✦ Nova solicitação',
      `${fromUserName} quer se conectar com você!`
    );

    return true;
  } catch (error) {
    console.error('enviarSolicitacao error:', error);
    return false;
  }
}

// Aceita solicitação
export async function aceitarSolicitacao(
  requestId: string,
  toUserName: string,
  fromUserId: string
): Promise<void> {
  const ref = doc(db, COLLECTIONS.CONNECTION_REQUESTS, requestId);
  await updateDoc(ref, { status: 'accepted' });

  // Notificação interna
  await createNotification(
    fromUserId,
    'sintonia',
    `${toUserName} aceitou sua solicitação! Vocês agora podem conversar 💬`
  );

  // Push notification
  const { sendPushToUser } = await import(
    '../../notifications/services/pushService'
  );
  await sendPushToUser(
    fromUserId,
    '💬 Solicitação aceita!',
    `${toUserName} aceitou sua solicitação! Comece a conversar agora.`
  );
}
// Rejeita solicitação
export async function rejeitarSolicitacao(requestId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.CONNECTION_REQUESTS, requestId);
  await updateDoc(ref, { status: 'rejected' });
}

// Escuta solicitações pendentes em tempo real
export function listenToRequests(
  userId: string,
  onRequests: (requests: ConnectionRequest[]) => void
): () => void {
  const q = query(
    collection(db, COLLECTIONS.CONNECTION_REQUESTS),
    where('toUserId', '==', userId),
    where('status', '==', 'pending')
  );

  return onSnapshot(q, snap => {
    onRequests(snap.docs.map(mapRequest));
  });
}

// Verifica se dois usuários estão conectados
export async function estaoConectados(
  userId1: string,
  userId2: string
): Promise<boolean> {
  try {
    const [q1, q2] = [
      query(
        collection(db, COLLECTIONS.CONNECTION_REQUESTS),
        where('fromUserId', '==', userId1),
        where('toUserId', '==', userId2),
        where('status', '==', 'accepted')
      ),
      query(
        collection(db, COLLECTIONS.CONNECTION_REQUESTS),
        where('fromUserId', '==', userId2),
        where('toUserId', '==', userId1),
        where('status', '==', 'accepted')
      ),
    ];

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    return !snap1.empty || !snap2.empty;
  } catch {
    return false;
  }
}

// Busca conexões aceitas
export async function getConexoesAceitas(
  userId: string
): Promise<ConnectionRequest[]> {
  try {
    const [q1, q2] = [
      query(
        collection(db, COLLECTIONS.CONNECTION_REQUESTS),
        where('fromUserId', '==', userId),
        where('status', '==', 'accepted')
      ),
      query(
        collection(db, COLLECTIONS.CONNECTION_REQUESTS),
        where('toUserId', '==', userId),
        where('status', '==', 'accepted')
      ),
    ];

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    return [...snap1.docs, ...snap2.docs].map(mapRequest);
  } catch {
    return [];
  }
}
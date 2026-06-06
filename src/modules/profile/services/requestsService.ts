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
    fromUserPhoto: d.data().fromUserPhoto || '',
    status: d.data().status,
    timestamp: d.data().timestamp?.toDate() || new Date(),
  };
}

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

export async function enviarSolicitacao(
  fromUserId: string,
  fromUserName: string,
  fromUserPhoto: string | null | undefined,
  toUserId: string,
  toUserName: string
): Promise<boolean> {
  try {
    const existing = await getSolicitacaoEntre(fromUserId, toUserId);
    if (existing) return false;

    await addDoc(collection(db, COLLECTIONS.CONNECTION_REQUESTS), {
      fromUserId,
      toUserId,
      fromUserName: fromUserName || '',
      fromUserPhoto: fromUserPhoto || '',
      status: 'pending',
      timestamp: serverTimestamp(),
    });

    await createNotification(
      toUserId,
      'sintonia',
      `${fromUserName} quer se conectar com voce!`
    );

    const { sendPushToUser } = await import(
      '../../notifications/services/pushService'
    );
    // Passa data com type=request para redirecionamento
    await sendPushToUser(
      toUserId,
      'Nova solicitacao',
      `${fromUserName} quer se conectar com voce!`,
      { type: 'request' }
    );

    return true;
  } catch (error) {
    console.error('enviarSolicitacao error:', error);
    return false;
  }
}

export async function aceitarSolicitacao(
  requestId: string,
  toUserName: string,
  fromUserId: string
): Promise<void> {
  const ref = doc(db, COLLECTIONS.CONNECTION_REQUESTS, requestId);
  await updateDoc(ref, { status: 'accepted' });

  await createNotification(
    fromUserId,
    'sintonia',
    `${toUserName} aceitou sua solicitacao! Voces agora podem conversar`
  );

  const { sendPushToUser } = await import(
    '../../notifications/services/pushService'
  );
  await sendPushToUser(
    fromUserId,
    'Solicitacao aceita!',
    `${toUserName} aceitou sua solicitacao! Comece a conversar agora.`
  );
}

export async function rejeitarSolicitacao(requestId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.CONNECTION_REQUESTS, requestId);
  await updateDoc(ref, { status: 'rejected' });
}

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
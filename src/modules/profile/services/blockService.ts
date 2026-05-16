import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';

// ============================================
// BLOCK SERVICE — MÓDULO PROFILE
//
// Responsabilidade única:
// Gerenciar bloqueios entre usuários.
// ============================================

export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  blockedName: string;
  blockedPhoto: string;
  timestamp: Date;
}

// Verifica se está bloqueado
export async function estaBloqueado(
  blockerId: string,
  blockedId: string
): Promise<boolean> {
  try {
    const q = query(
      collection(db, COLLECTIONS.BLOCKS),
      where('blockerId', '==', blockerId),
      where('blockedId', '==', blockedId)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false;
  }
}

// Bloqueia usuário
export async function bloquearUsuario(
  blockerId: string,
  blockedId: string,
  blockedName: string,
  blockedPhoto: string
): Promise<void> {
  const already = await estaBloqueado(blockerId, blockedId);
  if (already) return;

  await addDoc(collection(db, COLLECTIONS.BLOCKS), {
    blockerId,
    blockedId,
    blockedName,
    blockedPhoto,
    timestamp: serverTimestamp(),
  });
}

// Desbloqueia usuário
export async function desbloquearUsuario(
  blockerId: string,
  blockedId: string
): Promise<void> {
  const q = query(
    collection(db, COLLECTIONS.BLOCKS),
    where('blockerId', '==', blockerId),
    where('blockedId', '==', blockedId)
  );
  const snap = await getDocs(q);
  await Promise.all(
    snap.docs.map(d => deleteDoc(doc(db, COLLECTIONS.BLOCKS, d.id)))
  );
}

// Busca lista de bloqueados
export async function getBloqueados(blockerId: string): Promise<Block[]> {
  const q = query(
    collection(db, COLLECTIONS.BLOCKS),
    where('blockerId', '==', blockerId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    blockerId: d.data().blockerId,
    blockedId: d.data().blockedId,
    blockedName: d.data().blockedName,
    blockedPhoto: d.data().blockedPhoto,
    timestamp: d.data().timestamp?.toDate() || new Date(),
  }));
}
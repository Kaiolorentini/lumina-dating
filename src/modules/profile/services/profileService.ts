import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';
import { UserProfile } from '../../../shared/types';

// ============================================
// PROFILE SERVICE — MÓDULO PROFILE
//
// saveProfile adiciona role/isBlocked APENAS no create
// (quando o documento não existe). Em qualquer update,
// esses campos protegidos NÃO entram no payload — evitando
// que a regra hasNoProtectedFields() bloqueie o update.
//
// createdAt também só no create (auditoria M8, 08/10/2026).
// Qualquer createdAt que chegue em `data` numa edição é
// descartado aqui: a data de cadastro não muda.
//
// Backup de segurança: initWallet (Admin SDK) garante
// role/isBlocked caso o documento seja criado por outro
// caminho antes do saveProfile.
// ============================================

export async function saveProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  const profileRef = doc(db, COLLECTIONS.USERS, uid);
  const existing   = await getDoc(profileRef);

  const { createdAt: _ignored, ...rest } = data;
  const isNew = !existing.exists();

  await setDoc(profileRef, {
    ...rest,
    ...(isNew && { role: 'user', isBlocked: false, createdAt: new Date() }),
    updatedAt: new Date(),
  }, { merge: true });
}

export async function getProfile(
  uid: string
): Promise<UserProfile | null> {
  const profileRef = doc(db, COLLECTIONS.USERS, uid);
  const snap       = await getDoc(profileRef);
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }
  return null;
}

export function isProfileComplete(profile: Partial<UserProfile>): boolean {
  return !!(
    profile.name &&
    profile.age &&
    profile.city &&
    profile.state &&
    profile.gender &&
    profile.preferences?.length
  );
}

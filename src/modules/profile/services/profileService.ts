import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';
import { UserProfile } from '../../../shared/types';

// ============================================
// PROFILE SERVICE — MÓDULO PROFILE
//
// Responsabilidade única:
// Salvar e buscar dados do perfil no Firestore.
// Sem upload de foto aqui — isso é photoService.
// ============================================

// Salva ou atualiza perfil
export async function saveProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  const profileRef = doc(db, COLLECTIONS.USERS, uid);

  // Verifica se é criação ou atualização
  const existing = await getDoc(profileRef);

  await setDoc(profileRef, {
    ...data,
    // Campos de segurança apenas na criação — nunca sobrescreve
    ...(!existing.exists() && { role: 'user', isBlocked: false }),
    updatedAt: new Date(),
  }, { merge: true });
}

// Busca perfil pelo ID
export async function getProfile(
  uid: string
): Promise<UserProfile | null> {
  const profileRef = doc(db, COLLECTIONS.USERS, uid);
  const snap = await getDoc(profileRef);
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }
  return null;
}

// Verifica se perfil está completo
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
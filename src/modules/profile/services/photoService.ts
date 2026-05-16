import { uploadToImgBB } from '../../../core/api/imgbb';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';

// ============================================
// PHOTO SERVICE
//
// Responsabilidade única:
// Upload de foto de perfil via ImgBB
// + salvar URL no Firestore
// ============================================

// Faz upload da foto e salva URL no Firestore
export async function uploadProfilePhoto(
  userId: string,
  uri: string
): Promise<string> {
  // Upload para ImgBB
  const result = await uploadToImgBB(uri, `profile_${userId}_${Date.now()}`);

  // Salva URL no Firestore
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  await setDoc(userRef, { photoURL: result.url }, { merge: true });

  return result.url;
}
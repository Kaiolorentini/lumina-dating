// ============================================
// PHOTO SERVICE v2.0
// src/modules/profile/services/photoService.ts
//
// v2.0: migrado de ImgBB para Firebase Storage.
// Upload para storage/profile_photos/{userId}/photo.jpg
// URL pública salva no Firestore users/{userId}.photoURL
// Compatível com Android e iOS via fetch + blob
// ============================================

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { db, storage } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';

// Converte URI local para Blob — compatível com React Native
async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

export async function uploadProfilePhoto(
  userId: string,
  uri: string,
  onProgress?: (percent: number) => void,
): Promise<string> {

  // Se já é URL remota — não faz upload novamente
  if (uri.startsWith('https://')) {
    return uri;
  }

  const blob        = await uriToBlob(uri);
  const storagePath = `profile_photos/${userId}/photo.jpg`;
  const storageRef  = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: 'image/jpeg',
    });

    uploadTask.on(
      'state_changed',
      snapshot => {
        if (onProgress && snapshot.totalBytes > 0) {
          const percent = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          onProgress(percent);
        }
      },
      error => {
        console.error('[photoService] Erro no upload:', error);
        reject(new Error('Erro ao fazer upload da foto. Tente novamente.'));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Salva URL no Firestore
          const userRef = doc(db, COLLECTIONS.USERS, userId);
          await setDoc(userRef, { photoURL: downloadURL }, { merge: true });

          resolve(downloadURL);
        } catch (error) {
          console.error('[photoService] Erro ao obter URL:', error);
          reject(new Error('Erro ao finalizar upload. Tente novamente.'));
        }
      },
    );
  });
}
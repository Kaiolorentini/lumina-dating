// ============================================
// PHOTO SERVICE v3.0
// src/modules/profile/services/photoService.ts
//
// v3.1: leitura da imagem extraída para
// shared/utils/imageBlob.ts — a verificação de idade usa a
// mesma função, e duas cópias divergiriam com o tempo.
// O histórico das tentativas que falharam está lá.
//
// Upload para storage/profile_photos/{userId}/photo.jpg
// URL pública salva no Firestore users/{userId}.photoURL
// ============================================

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { db, storage } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';
import { resolveImageBlob } from '../../../shared/utils/imageBlob';

export async function uploadProfilePhoto(
  userId: string,
  uri: string,
  base64: string | null = null,
  onProgress?: (percent: number) => void,
): Promise<string> {

  // Se já é URL remota — não faz upload novamente
  if (uri.startsWith('https://')) {
    return uri;
  }

  if (!uri && !base64) {
    throw new Error(
      'Imagem sem dados. Escolha a foto novamente na galeria.'
    );
  }

  const blob        = await resolveImageBlob(uri, base64);
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
        // O código do Firebase é o que distingue tamanho excedido
        // (storage/unauthorized pela rule) de falha de rede.
        const code = (error as { code?: string })?.code ?? 'desconhecido';
        reject(new Error(`Falha no upload (${code}). Tente uma foto menor.`));
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
// ============================================
// PHOTO SERVICE v4.0
// src/modules/profile/services/photoService.ts
//
// v4.0 (29/09): galeria do perfil + redução das fotos.
// - Toda foto é reduzida para 1080 px de largura e JPEG 70% antes do
//   envio (expo-image-manipulator): ~200–400 KB, contra até 5 MB.
// - uploadImage é compartilhado entre a foto de perfil e a galeria.
//
// Foto de perfil: profile_photos/{uid}/photo.jpg → users.photoURL
//   (caminho exato que registra a missão "Atualizar foto").
// Galeria: profile_photos/{uid}/gallery_{1..3}.jpg → publicada pela
//   CF setGalleryPhoto, que monta o link a partir do arquivo.
// ============================================

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import app, { db, storage } from '../../../core/firebase';
import { COLLECTIONS } from '../../../core/constants';
import { resolveImageBlob } from '../../../shared/utils/imageBlob';

export type GallerySlot = 1 | 2 | 3;
export const GALLERY_SLOTS: GallerySlot[] = [1, 2, 3];

export interface GalleryEntry {
  url:       string;
  updatedAt: number;
}

const MAX_WIDTH = 1080;
const JPEG_QUALITY = 0.7;

/**
 * Reduz para no máximo 1080 px de largura e recomprime em JPEG.
 * Devolve uri e base64 do resultado — o base64 é o caminho que
 * funciona no Android (ver shared/utils/imageBlob.ts).
 */
export async function shrinkImage(
  uri: string,
  width: number,
): Promise<{ uri: string; base64: string | null }> {
  const context = ImageManipulator.manipulate(uri);
  if (width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
  const image  = await context.renderAsync();
  const result = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG, base64: true });
  return { uri: result.uri, base64: result.base64 ?? null };
}

/** Envia a imagem para o caminho e devolve o link de download. */
async function uploadImage(
  storagePath: string,
  uri: string,
  base64: string | null,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (!uri && !base64) {
    throw new Error('Imagem sem dados. Escolha a foto novamente na galeria.');
  }

  const blob       = await resolveImageBlob(uri, base64);
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });

    uploadTask.on(
      'state_changed',
      snapshot => {
        if (onProgress && snapshot.totalBytes > 0) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      error => {
        console.error('[photoService] Erro no upload:', error);
        const code = (error as { code?: string })?.code ?? 'desconhecido';
        reject(new Error(`Falha no upload (${code}). Tente outra foto.`));
      },
      async () => {
        try {
          resolve(await getDownloadURL(uploadTask.snapshot.ref));
        } catch (error) {
          console.error('[photoService] Erro ao obter URL:', error);
          reject(new Error('Erro ao finalizar upload. Tente novamente.'));
        }
      },
    );
  });
}

export async function uploadProfilePhoto(
  userId: string,
  uri: string,
  base64: string | null = null,
  onProgress?: (percent: number) => void,
): Promise<string> {
  // Se já é URL remota — não faz upload novamente
  if (uri.startsWith('https://')) return uri;

  const downloadURL = await uploadImage(`profile_photos/${userId}/photo.jpg`, uri, base64, onProgress);
  await setDoc(doc(db, COLLECTIONS.USERS, userId), { photoURL: downloadURL }, { merge: true });
  return downloadURL;
}

function fns() {
  return getFunctions(app, 'us-central1');
}

/** Reduz, envia para a vaga e pede ao servidor para publicar. */
export async function saveGalleryPhoto(
  userId: string,
  slot: GallerySlot,
  uri: string,
  width: number,
  onProgress?: (percent: number) => void,
): Promise<GalleryEntry> {
  const small = await shrinkImage(uri, width);
  await uploadImage(`profile_photos/${userId}/gallery_${slot}.jpg`, small.uri, small.base64, onProgress);
  const res = await httpsCallable<{ slot: GallerySlot }, GalleryEntry & { slot: GallerySlot }>(
    fns(), 'setGalleryPhoto',
  )({ slot });
  return { url: res.data.url, updatedAt: res.data.updatedAt };
}

export async function removeGalleryPhoto(slot: GallerySlot): Promise<void> {
  await httpsCallable(fns(), 'removeGalleryPhoto')({ slot });
}

/** Moderação (superadmin). */
export async function adminRemoveGalleryPhoto(userId: string, slot: GallerySlot, reason: string): Promise<void> {
  await httpsCallable(fns(), 'adminRemoveGalleryPhoto')({ userId, slot, reason });
}

/**
 * Fotos da galeria em ordem de vaga. O `&v=` força a imagem nova na
 * tela quando a vaga é sobrescrita (o link do arquivo pode ser igual).
 */
export function galleryPhotos(profile: unknown): Array<{ slot: GallerySlot; uri: string }> {
  const gallery = ((profile as { gallery?: Record<string, GalleryEntry> } | null)?.gallery) ?? {};
  return GALLERY_SLOTS
    .map(slot => ({ slot, entry: gallery[String(slot)] }))
    .filter((g): g is { slot: GallerySlot; entry: GalleryEntry } => !!g.entry?.url)
    .map(g => ({ slot: g.slot, uri: `${g.entry.url}&v=${g.entry.updatedAt}` }));
}
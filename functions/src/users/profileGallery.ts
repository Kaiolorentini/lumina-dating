// ============================================
// LUMINA — GALERIA DO PERFIL (3 fotos além da principal)
// functions/src/users/profileGallery.ts
//
// O app reduz a foto (1080 px), envia para
// profile_photos/{uid}/gallery_{vaga}.jpg e pede ao servidor para
// publicá-la. O servidor confere o arquivo e MONTA o link — o app
// nunca grava um link na galeria, então não entra imagem de fora.
//
// Vaga fixa: trocar sobrescreve, e o Storage nunca passa de 3 fotos
// por pessoa. O nome gallery_N.jpg não aciona a missão de foto de
// perfil (onProfilePhotoUploaded só reconhece photo.jpg).
//
// Moderação por denúncia: o superadmin remove qualquer foto
// (adminRemoveGalleryPhoto) e a pessoa é avisada com o motivo.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin     from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { assertAuthenticated, assertSuperAdmin } from '../utils/adminGuard';
import { assertUserNotBlocked } from '../utils/assertUserNotBlocked';
import { createAuditLog } from '../utils/auditLog';
import { notifyUser } from '../utils/notifyUser';

const SLOTS     = new Set([1, 2, 3]);
const MAX_BYTES = 5 * 1024 * 1024;
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function assertSlot(v: unknown): number {
  const slot = Number(v);
  if (!SLOTS.has(slot)) throw new HttpsError('invalid-argument', 'Vaga inválida.');
  return slot;
}

function galleryPath(uid: string, slot: number): string {
  return `profile_photos/${uid}/gallery_${slot}.jpg`;
}

async function deleteSlot(uid: string, slot: number): Promise<void> {
  await admin.storage().bucket().file(galleryPath(uid, slot)).delete({ ignoreNotFound: true });
  await admin.firestore().collection('users').doc(uid).update({
    [`gallery.${slot}`]: FieldValue.delete(),
  });
}

export const setGalleryPhoto = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;
  await assertUserNotBlocked(uid);

  const slot   = assertSlot((request.data ?? {}).slot);
  const path   = galleryPath(uid, slot);
  const bucket = admin.storage().bucket();

  let meta: { contentType?: string; size?: string | number; metadata?: Record<string, string> };
  try {
    [meta] = await bucket.file(path).getMetadata();
  } catch {
    throw new HttpsError('failed-precondition', 'A foto não terminou de enviar. Tente de novo.');
  }

  if (!String(meta.contentType ?? '').startsWith('image/')) {
    throw new HttpsError('invalid-argument', 'O arquivo precisa ser uma imagem.');
  }
  if (Number(meta.size ?? 0) > MAX_BYTES) {
    throw new HttpsError('invalid-argument', 'A foto é grande demais (máximo 5 MB).');
  }

  const token = String(meta.metadata?.firebaseStorageDownloadTokens ?? '').split(',')[0];
  if (!token) throw new HttpsError('failed-precondition', 'A foto não terminou de enviar. Tente de novo.');

  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  const updatedAt = Date.now();

  await admin.firestore().collection('users').doc(uid).set({
    gallery: { [String(slot)]: { url, updatedAt } },
  }, { merge: true });

  return { success: true, slot, url, updatedAt };
});

export const removeGalleryPhoto = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;
  const slot = assertSlot((request.data ?? {}).slot);
  await deleteSlot(uid, slot);
  return { success: true, slot };
});

/** Moderação: o superadmin remove uma foto denunciada. */
export const adminRemoveGalleryPhoto = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const adminUid: string = request.auth!.uid;
  await assertSuperAdmin(adminUid);

  const d = (request.data ?? {}) as { userId?: unknown; slot?: unknown; reason?: unknown };
  if (typeof d.userId !== 'string' || !UID_PATTERN.test(d.userId)) {
    throw new HttpsError('invalid-argument', 'Usuário inválido.');
  }
  const slot   = assertSlot(d.slot);
  const reason = typeof d.reason === 'string' ? d.reason.trim().slice(0, 200) : '';
  if (!reason) throw new HttpsError('invalid-argument', 'Informe o motivo.');

  await deleteSlot(d.userId, slot);

  await createAuditLog({
    action: 'gallery_photo_removed',
    performedBy: adminUid,
    targetId: d.userId,
    targetType: 'user',
    metadata: { slot, reason },
    req: request.rawRequest,
  });

  notifyUser({
    userId: d.userId,
    title:  '📷 Uma foto sua foi removida',
    body:   `Motivo: ${reason}. Fotos fora das regras da galeria são removidas, e repetir pode levar à suspensão da conta.`,
    type:   'gallery_photo_removed',
  }).catch(() => {});

  return { success: true };
});
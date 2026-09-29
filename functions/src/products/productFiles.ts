// ============================================
// LUMINA — ARQUIVOS DE PRODUTO (regras de visibilidade)
// functions/src/products/productFiles.ts
//
// Cada item de product.files pode ter:
//   status: 'pending'  → arquivo novo esperando o admin. NINGUÉM vê.
//                        Sem o campo = aprovado (todos os legados).
//   addedAt            → quando entrou.
//   removedAt          → quando o criador removeu. Quem comprou ANTES
//                        continua vendo; quem compra depois, não.
//
// Arquivos removidos FICAM na lista: a moderação abre arquivos pela
// posição (getModeratorFileUrl com fileIndex), e o comprador antigo
// precisa continuar achando o dele.
// ============================================

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export interface ProductFileEntry {
  storagePath: string;
  type:        string;
  name:        string;
  size:        number;
  mimeType:    string;
  status?:     'approved' | 'pending';
  addedAt?:    Timestamp;
  approvedAt?: Timestamp;
  removedAt?:  Timestamp;
}

export function isPendingFile(f: ProductFileEntry): boolean {
  return f.status === 'pending';
}

/** À venda para quem compra AGORA. */
export function isActiveForSale(f: ProductFileEntry): boolean {
  return f.status !== 'pending' && !f.removedAt;
}

/** Visível para um comprador, conforme a data da compra. */
export function isVisibleToBuyer(f: ProductFileEntry, purchasedAt: Date | null): boolean {
  if (f.status === 'pending') return false;
  if (!f.removedAt) return true;
  if (!purchasedAt) return false;
  return purchasedAt.getTime() < f.removedAt.toMillis();
}

const ALLOWED_MIME = /^(image|video|audio)\/|^application\/(pdf|zip|x-zip-compressed)$/;

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.test(mime);
}

export function fileTypeFromMime(mime: string): string {
  if (mime.startsWith('image/')) return 'imagem';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  return 'outro';
}

/** A capa é pública nas regras do Storage: a URL dispensa token. */
export function publicCoverUrl(path: string): string {
  const bucket = admin.storage().bucket().name;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

export async function deleteStorageQuietly(paths: string[]): Promise<void> {
  const bucket = admin.storage().bucket();
  await Promise.all(
    paths.map(p => bucket.file(p).delete({ ignoreNotFound: true }).catch(error => {
      console.warn('[productFiles] Falha ao apagar', p, error);
    })),
  );
}
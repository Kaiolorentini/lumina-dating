// ============================================
// LUMINA — RASCUNHO DA VERIFICAÇÃO DE IDADE (WEB)
// src/modules/verification/services/verificationDraft.web.ts
//
// Versão do navegador. O Metro escolhe este arquivo só na web; o
// app continua com verificationDraft.ts.
//
// SÓ EM MEMÓRIA, de propósito: no navegador a foto é um endereço
// data:/blob: com a imagem dentro. Gravá-la no localStorage deixaria
// a foto do DOCUMENTO no navegador (LGPD) e estouraria o limite de
// ~5 MB. O motivo do rascunho no app (o Android encerrar o app com a
// câmera aberta) não existe na web. Recarregar a página = recomeçar.
//
// Mesmos exports do verificationDraft.ts.
// ============================================

import type { DraftCaptures, VerificationDraft } from './verificationDraftModel';
import { EMPTY_DRAFT } from './verificationDraftModel';

export type { DraftCaptures, VerificationDraft };
export { EMPTY_DRAFT };

type Listener = (draft: VerificationDraft) => void;

interface UrlApi { revokeObjectURL(url: string): void }

let memoryUid: string | null = null;
let memoryDraft: VerificationDraft = EMPTY_DRAFT;
const subscribers = new Set<{ uid: string; fn: Listener }>();

function notify(uid: string, draft: VerificationDraft): void {
  subscribers.forEach(sub => {
    if (sub.uid === uid) sub.fn(draft);
  });
}

/** Libera a memória de uma foto (endereço blob:). Nunca lança. */
export async function deleteLocalFile(uri: string | null | undefined): Promise<void> {
  if (typeof uri !== 'string' || !uri.startsWith('blob:')) return;
  try {
    (globalThis as unknown as { URL?: UrlApi }).URL?.revokeObjectURL(uri);
  } catch {
    /* já liberado */
  }
}

export function getDraft(uid: string): VerificationDraft {
  return memoryUid === uid ? memoryDraft : EMPTY_DRAFT;
}

export async function loadDraft(uid: string): Promise<VerificationDraft> {
  if (memoryUid === uid) return memoryDraft;
  memoryUid = uid;
  memoryDraft = EMPTY_DRAFT;
  notify(uid, memoryDraft);
  return memoryDraft;
}

export function updateDraft(
  uid: string,
  mutate: (draft: VerificationDraft) => VerificationDraft,
): Promise<void> {
  const base = memoryUid === uid ? memoryDraft : EMPTY_DRAFT;
  const next: VerificationDraft = { ...mutate(base), updatedAt: Date.now() };
  memoryUid = uid;
  memoryDraft = next;
  notify(uid, next);
  return Promise.resolve();
}

export async function clearDraft(
  uid: string,
  options: { notify?: boolean } = {},
): Promise<void> {
  const known: DraftCaptures | null = memoryUid === uid ? memoryDraft.captures : null;

  if (memoryUid === uid) {
    memoryDraft = EMPTY_DRAFT;
    if (options.notify !== false) notify(uid, EMPTY_DRAFT);
  }

  if (known) {
    await Promise.all(Object.values(known).map(deleteLocalFile));
  }
}

export function subscribeDraft(uid: string, fn: Listener): () => void {
  const sub = { uid, fn };
  subscribers.add(sub);
  return () => {
    subscribers.delete(sub);
  };
}

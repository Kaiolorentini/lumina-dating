// ============================================
// LUMINA — MODERAÇÃO DE PRODUTO (chamadas ao servidor)
// src/services/moderation/productModerationService.ts
//
// As três decisões do admin passam SEMPRE pelo questionário
// (12/10/2026). O servidor confere tudo de novo e grava o registro
// em moderationRecords — o app só envia as respostas.
//
// O rascunho das respostas fica em memória por produto: o admin pode
// voltar para a revisão, abrir os arquivos e retomar o questionário
// sem perder o que já marcou. Some ao fechar o app ou ao concluir.
// ============================================

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../core/firebase';
import {
  ChecklistAnswer, ChecklistPayload, PRODUCT_CHECKLIST_VERSION,
} from '../../config/moderation/productChecklist';

export type ProductReviewMode = 'product' | 'changes';

export interface ChecklistDraft {
  answers: Record<string, ChecklistAnswer>;
  notes: Record<string, string>;
}

const drafts = new Map<string, ChecklistDraft>();

function draftKey(productId: string, mode: ProductReviewMode): string {
  return `${mode}:${productId}`;
}

export function getChecklistDraft(productId: string, mode: ProductReviewMode): ChecklistDraft {
  return drafts.get(draftKey(productId, mode)) ?? { answers: {}, notes: {} };
}

export function saveChecklistDraft(productId: string, mode: ProductReviewMode, draft: ChecklistDraft): void {
  drafts.set(draftKey(productId, mode), draft);
}

export function clearChecklistDraft(productId: string, mode: ProductReviewMode): void {
  drafts.delete(draftKey(productId, mode));
}

function toPayload(draft: ChecklistDraft): ChecklistPayload {
  const notes: Record<string, string> = {};
  Object.entries(draft.notes).forEach(([id, note]) => {
    const trimmed = note.trim();
    if (trimmed && draft.answers[id] === 'rejected') notes[id] = trimmed.slice(0, 300);
  });
  return { version: PRODUCT_CHECKLIST_VERSION, answers: draft.answers, notes };
}

const functions = () => getFunctions(app, 'us-central1');

/** Mensagem do servidor (HttpsError) ou genérica. */
export function moderationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Não foi possível concluir agora. Tente de novo.';
}

/** Aprova produto novo — todos os itens precisam estar aprovados. */
export async function approveProduct(productId: string, draft: ChecklistDraft): Promise<void> {
  const fn = httpsCallable<{ productId: string; checklist: ChecklistPayload }, { success: boolean }>(
    functions(), 'onApproveProduct',
  );
  await fn({ productId, checklist: toPayload(draft) });
}

/** Recusa produto — pelo menos um item negado; o motivo é montado no servidor. */
export async function rejectProduct(productId: string, draft: ChecklistDraft): Promise<void> {
  const fn = httpsCallable<{ productId: string; checklist: ChecklistPayload }, { success: boolean }>(
    functions(), 'onRejectProduct',
  );
  await fn({ productId, checklist: toPayload(draft) });
}

/** Aprova ou recusa as alterações (capa/arquivos novos) de produto à venda. */
export async function reviewProductChanges(productId: string, approve: boolean, draft: ChecklistDraft): Promise<void> {
  const fn = httpsCallable<{ productId: string; approve: boolean; checklist: ChecklistPayload }, { success: boolean }>(
    functions(), 'reviewProductChanges',
  );
  await fn({ productId, approve, checklist: toPayload(draft) });
}

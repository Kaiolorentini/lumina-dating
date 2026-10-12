// ============================================
// LUMINA — REGISTROS DE MODERAÇÃO (prova a favor da Lumina)
// functions/src/moderation/moderationRecords.ts
//
// Coleção moderationRecords (12/10/2026): um documento por análise de
// produto, de alteração de produto ou de verificação de idade — quem
// analisou, quando, a versão do questionário, cada resposta e o
// resultado. Serve de prova de diligência (ECA Digital, ANPD, polícia,
// processadores de pagamento).
//
// • Gravado SÓ pelo servidor, dentro da mesma transação que muda o
//   status — não existe aprovação sem registro.
// • Imutável: o app não tem regra para esta coleção (o Firestore nega
//   tudo por padrão) e nenhuma função atualiza ou apaga.
// • Guardado por 5 anos (Política de Privacidade, seção 22).
// ============================================

import * as admin from 'firebase-admin';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import { ParsedChecklist } from '../config/productChecklist';

export type ModerationRecordType = 'product' | 'product_changes';
export type ModerationOutcome = 'approved' | 'rejected';

export interface ProductSnapshot {
  title: string;
  price: number;
  isFree: boolean;
  category: string;
  coverStoragePath: string | null;
  previewCount: number;
  /** Arquivos analisados (caminho no Storage e tipo). */
  files: Array<{ storagePath: string; mimeType: string }>;
  version: number;
}

export interface ProductModerationInput {
  type: ModerationRecordType;
  productId: string;
  ownerId: string;
  reviewerUid: string;
  checklist: ParsedChecklist;
  outcome: ModerationOutcome;
  /** Motivo enviado ao criador (só na recusa). */
  reason: string | null;
  childSafetyFlag: boolean;
  snapshot: ProductSnapshot;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Monta o retrato do produto no momento da análise. */
export function snapshotProduct(
  product: FirebaseFirestore.DocumentData,
  options: { onlyPendingFiles?: boolean; pendingCoverPath?: string | null } = {},
): ProductSnapshot {
  const files = Array.isArray(product.files) ? product.files as Array<Record<string, unknown>> : [];
  const reviewed = options.onlyPendingFiles ? files.filter(f => f.status === 'pending') : files;
  return {
    title:            String(product.title ?? ''),
    price:            num(product.price),
    isFree:           product.isFree === true,
    category:         String(product.category ?? ''),
    coverStoragePath: options.pendingCoverPath ?? (typeof product.coverStoragePath === 'string' ? product.coverStoragePath : null),
    previewCount:     Array.isArray(product.previewImages) ? product.previewImages.length : 0,
    files:            reviewed.map(f => ({ storagePath: String(f.storagePath ?? ''), mimeType: String(f.mimeType ?? '') })),
    version:          num(product.version),
  };
}

/** Grava o registro dentro da transação que muda o status. */
export function writeProductModerationRecord(t: Transaction, input: ProductModerationInput): string {
  const ref = admin.firestore().collection('moderationRecords').doc();
  t.set(ref, {
    type:             input.type,
    productId:        input.productId,
    ownerId:          input.ownerId,
    reviewerUid:      input.reviewerUid,
    checklistVersion: input.checklist.version,
    answers:          input.checklist.answers,
    notes:            input.checklist.notes,
    rejectedItems:    input.checklist.rejectedIds,
    outcome:          input.outcome,
    reason:           input.reason,
    childSafetyFlag:  input.childSafetyFlag,
    snapshot:         input.snapshot,
    createdAt:        FieldValue.serverTimestamp(),
    imutavel:         true,
  });
  return ref.id;
}

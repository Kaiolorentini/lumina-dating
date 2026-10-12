// ============================================
// LUMINA — CONTRATO DO CRIADOR E DECLARAÇÃO DO PRODUTO
// functions/src/creators/creatorAgreements.ts
//
// 12/10/2026. Duas assinaturas eletrônicas (MP 2.200-2/2001, art. 10, §2º):
//
// 1. CONTRATO DO CRIADOR — aceito UMA vez, antes do primeiro produto,
//    e de novo quando CREATOR_CONTRACT_VERSION muda.
//    callable acceptCreatorContract.
//
// 2. DECLARAÇÃO DO PRODUTO — aceita a CADA envio para análise:
//    • produto novo / reenvio após recusa → callable
//      submitProductForReview (substitui a gravação direta do app,
//      que as regras deixam de permitir);
//    • capa ou arquivos novos em produto à venda → dentro do
//      submitProductChanges (productChanges.ts), com
//      recordProductDeclaration().
//
// Onde fica (coleção creatorAgreements, escrita SÓ pelo servidor):
//   creatorAgreements/{uid}                 → situação atual
//     (versão do contrato aceita, quando, hash) — o app lê para
//     saber se precisa mostrar o contrato;
//   creatorAgreements/{uid}/history/{id}    → cada aceite, imutável:
//     tipo, versão, hash SHA-256 do texto exato, produto, versão do
//     app, IP e navegador/aparelho. É a prova a favor da Lumina.
//
// A aprovação do produto (onApproveProduct / reviewProductChanges)
// confere que a declaração existe — sem ela não publica.
// ============================================

import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import { assertAuthenticated } from '../utils/adminGuard';
import { assertUserNotBlocked } from '../utils/assertUserNotBlocked';
import { createAuditLog } from '../utils/auditLog';
import { isBelowMinimumPrice } from '../config/marketplacePricing';
import {
  CREATOR_CONTRACT_VERSION, PRODUCT_DECLARATION_VERSION,
  creatorContractPlainText, productDeclarationPlainText, sha256,
} from '../config/creatorAgreement';

const CREATOR_ROLES = ['creator', 'admin', 'superadmin'];
const MAX_APP_VERSION = 40;

/** Códigos lidos pelo app em error.details.code. */
export const AGREEMENT_ERROR = {
  CONTRACT_REQUIRED: 'CONTRACT_REQUIRED',
  DECLARATION_REQUIRED: 'DECLARATION_REQUIRED',
} as const;

// Hash calculado uma vez por instância: o texto não muda em execução.
const CONTRACT_SHA256 = sha256(creatorContractPlainText());

export interface AcceptanceContext {
  appVersion: string | null;
  platform: string | null;
  ip: string | null;
  userAgent: string | null;
}

/** Metadados do aceite (prova): versão do app, IP e navegador/aparelho. */
export function acceptanceContext(request: CallableRequest<unknown>): AcceptanceContext {
  const data = (request.data ?? {}) as { appVersion?: unknown; platform?: unknown };
  const raw = request.rawRequest;
  const header = raw?.headers?.['user-agent'];
  return {
    appVersion: typeof data.appVersion === 'string' ? data.appVersion.slice(0, MAX_APP_VERSION) : null,
    platform: data.platform === 'android' || data.platform === 'ios' || data.platform === 'web' ? data.platform : null,
    ip: typeof raw?.ip === 'string' ? raw.ip : null,
    userAgent: typeof header === 'string' ? header.slice(0, 300) : null,
  };
}

function agreementRef(uid: string) {
  return admin.firestore().collection('creatorAgreements').doc(uid);
}

/** Confere, dentro da transação, se o contrato vigente foi aceito. */
export async function assertContractAccepted(t: Transaction, uid: string): Promise<void> {
  const snap = await t.get(agreementRef(uid));
  if (snap.data()?.contractVersion !== CREATOR_CONTRACT_VERSION) {
    throw new HttpsError(
      'failed-precondition',
      'Aceite o Contrato do Criador antes de enviar produtos.',
      { code: AGREEMENT_ERROR.CONTRACT_REQUIRED },
    );
  }
}

/** Confere a versão da declaração enviada pelo app. */
export function assertDeclarationVersion(raw: unknown): void {
  if (raw === undefined || raw === null) {
    throw new HttpsError(
      'failed-precondition',
      'Aceite a Declaração do Produto para enviar à análise.',
      { code: AGREEMENT_ERROR.DECLARATION_REQUIRED },
    );
  }
  if (raw !== PRODUCT_DECLARATION_VERSION) {
    throw new HttpsError('failed-precondition', 'A declaração foi atualizada. Atualize o app e tente de novo.');
  }
}

export interface DeclarationInput {
  uid: string;
  productId: string;
  productTitle: string;
  /** 'submission' = produto inteiro; 'changes' = capa/arquivos novos de produto à venda. */
  scope: 'submission' | 'changes';
  fileCount: number;
  coverStoragePath: string | null;
  context: AcceptanceContext;
}

/**
 * Grava a declaração do produto DENTRO da transação do envio.
 * Chame depois de todas as leituras da transação. Devolve o id.
 */
export function recordProductDeclaration(t: Transaction, input: DeclarationInput): string {
  const ref = agreementRef(input.uid).collection('history').doc();
  const text = productDeclarationPlainText(input.productTitle);
  t.set(ref, {
    kind: 'product_declaration',
    scope: input.scope,
    uid: input.uid,
    version: PRODUCT_DECLARATION_VERSION,
    textSha256: sha256(text),
    productId: input.productId,
    productTitle: input.productTitle,
    fileCount: input.fileCount,
    coverStoragePath: input.coverStoragePath,
    ...input.context,
    acceptedAt: FieldValue.serverTimestamp(),
    imutavel: true,
  });
  return ref.id;
}

async function assertCreatorRole(uid: string): Promise<void> {
  const snap = await admin.firestore().collection('users').doc(uid).get();
  const role = snap.data()?.role;
  if (typeof role !== 'string' || !CREATOR_ROLES.includes(role)) {
    throw new HttpsError('permission-denied', 'Apenas criadores aprovados podem fazer isso.');
  }
}

// ============================================
// CONTRATO (criador)
// ============================================
export const acceptCreatorContract = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;
  await assertUserNotBlocked(uid);
  await assertCreatorRole(uid);

  const { version } = (request.data ?? {}) as { version?: unknown };
  if (version !== CREATOR_CONTRACT_VERSION) {
    throw new HttpsError('failed-precondition', 'O contrato foi atualizado. Atualize o app e leia a versão nova.');
  }

  const context = acceptanceContext(request);
  const currentRef = agreementRef(uid);
  // Id fixo por versão: aceitar duas vezes a mesma versão não duplica.
  const historyRef = currentRef.collection('history').doc(`contract_${CREATOR_CONTRACT_VERSION}`);

  const alreadyAccepted = await admin.firestore().runTransaction(async (t) => {
    const historySnap = await t.get(historyRef);
    if (historySnap.exists) {
      // Garante a situação atual alinhada (ex.: se um merge anterior falhou).
      t.set(currentRef, {
        uid,
        contractVersion: CREATOR_CONTRACT_VERSION,
        contractSha256: CONTRACT_SHA256,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return true;
    }
    t.set(historyRef, {
      kind: 'creator_contract',
      uid,
      version: CREATOR_CONTRACT_VERSION,
      textSha256: CONTRACT_SHA256,
      ...context,
      acceptedAt: FieldValue.serverTimestamp(),
      imutavel: true,
    });
    t.set(currentRef, {
      uid,
      contractVersion: CREATOR_CONTRACT_VERSION,
      contractSha256: CONTRACT_SHA256,
      contractAcceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return false;
  });

  if (!alreadyAccepted) {
    await createAuditLog({
      action: 'creator_contract_accepted',
      performedBy: uid,
      targetId: uid,
      targetType: 'user',
      metadata: { version: CREATOR_CONTRACT_VERSION, textSha256: CONTRACT_SHA256 },
      req: request.rawRequest,
    }).catch((error: unknown) => console.error('[acceptCreatorContract] audit falhou:', error));
    console.log(`[acceptCreatorContract] ${uid} aceitou o contrato ${CREATOR_CONTRACT_VERSION}`);
  }

  return { success: true, version: CREATOR_CONTRACT_VERSION };
});

// ============================================
// ENVIO PARA ANÁLISE COM DECLARAÇÃO (criador)
// ============================================
export const submitProductForReview = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;
  await assertUserNotBlocked(uid);
  await assertCreatorRole(uid);

  const data = (request.data ?? {}) as { productId?: unknown; declarationVersion?: unknown };
  const productId = data.productId;
  if (typeof productId !== 'string' || !productId || productId.includes('/')) {
    throw new HttpsError('invalid-argument', 'productId obrigatório');
  }
  assertDeclarationVersion(data.declarationVersion);

  const context = acceptanceContext(request);
  const db = admin.firestore();
  const productRef = db.collection('products').doc(productId);

  const result = await db.runTransaction(async (t) => {
    // Leituras primeiro (regra das transações).
    const snap = await t.get(productRef);
    await assertContractAccepted(t, uid);

    if (!snap.exists) throw new HttpsError('not-found', 'Produto não encontrado');
    const product = snap.data()!;
    if (product.ownerId !== uid) throw new HttpsError('permission-denied', 'Sem permissão');
    if (product.isDeleted === true) throw new HttpsError('failed-precondition', 'Este produto foi retirado da venda.');
    if (!['draft', 'rejected'].includes(product.status)) {
      throw new HttpsError('failed-precondition', 'Produto já está em revisão ou aprovado');
    }
    if (!product.coverImage) throw new HttpsError('failed-precondition', 'Adicione uma capa antes de enviar');
    const files = Array.isArray(product.files) ? product.files : [];
    if (files.length === 0) throw new HttpsError('failed-precondition', 'Adicione pelo menos um arquivo antes de enviar');
    if (isBelowMinimumPrice(product.price)) {
      throw new HttpsError('failed-precondition', 'Preço abaixo do mínimo de R$ 19,99. Ajuste o preço ou marque como gratuito.');
    }

    const title = String(product.title ?? '');
    const declarationId = recordProductDeclaration(t, {
      uid,
      productId,
      productTitle: title,
      scope: 'submission',
      fileCount: files.length,
      coverStoragePath: typeof product.coverStoragePath === 'string' ? product.coverStoragePath : null,
      context,
    });

    // O trigger onProductPending avisa os admins (status → pending).
    t.update(productRef, {
      status: 'pending',
      declarationId,
      declarationVersion: PRODUCT_DECLARATION_VERSION,
      submittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { declarationId, title };
  });

  await createAuditLog({
    action: 'product_submitted_with_declaration',
    performedBy: uid,
    targetId: productId,
    targetType: 'product',
    metadata: { declarationId: result.declarationId, declarationVersion: PRODUCT_DECLARATION_VERSION },
    req: request.rawRequest,
  }).catch((error: unknown) => console.error('[submitProductForReview] audit falhou:', error));

  return { success: true, declarationId: result.declarationId };
});

/**
 * Usada pela aprovação: confere que a declaração existe, é do dono e
 * deste produto. Leitura dentro da transação da aprovação.
 */
export async function assertDeclarationOnFile(
  t: Transaction,
  ownerId: string,
  productId: string,
  declarationId: unknown,
  scope: 'submission' | 'changes',
): Promise<void> {
  const fail = () => new HttpsError(
    'failed-precondition',
    scope === 'changes'
      ? 'Estas alterações foram enviadas sem a Declaração do Produto. Recuse e peça ao criador para enviar de novo.'
      : 'Este produto foi enviado sem a Declaração do Produto. Recuse e peça ao criador para enviar de novo.',
  );
  if (typeof declarationId !== 'string' || !declarationId || declarationId.includes('/')) throw fail();
  const snap = await t.get(agreementRef(ownerId).collection('history').doc(declarationId));
  const d = snap.data();
  if (!snap.exists || d?.kind !== 'product_declaration' || d?.productId !== productId || d?.uid !== ownerId) {
    throw fail();
  }
}

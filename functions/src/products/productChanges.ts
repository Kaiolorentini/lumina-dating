// ============================================
// LUMINA — EDIÇÃO, MODERAÇÃO DE ALTERAÇÕES E RETIRADA DE PRODUTOS
// functions/src/products/productChanges.ts
//
// submitProductChanges (criador)
//   • descrição e remoções valem NA HORA;
//   • em produto APROVADO, capa e arquivos novos ficam em análise
//     (status 'pending' / pendingCover) e o produto segue à venda
//     com a versão aprovada;
//   • em rascunho ou rejeitado, tudo vale na hora (o produto inteiro
//     ainda passa pela análise ao ser enviado).
//
//   • 12/10/2026: capa ou arquivos novos em produto À VENDA exigem a
//     Declaração do Produto (creatorAgreements.ts) e o Contrato do
//     Criador aceito; a declaração é gravada na MESMA transação e o
//     id fica em pendingChangesDeclarationId.
//
// reviewProductChanges (superadmin) — aprova ou rejeita o que está
//   em análise. Desde 12/10/2026 exige o questionário de moderação
//   (config/productChecklist.ts): aprovar só com todos os itens
//   aprovados; recusar com pelo menos um negado. O motivo é montado
//   pelo servidor e a análise vai para moderationRecords na mesma
//   transação. Aprovar exige a declaração das alterações (12/10/2026).
//
// unpublishProduct (criador) — tira da venda. Quem comprou mantém o
//   acesso; os arquivos só são apagados se ninguém comprou.
//
// getPurchasedContent (comprador) — os arquivos que ESTA compra pode
//   ver: sem os que estão em análise e sem os removidos depois dela.
//   Na PRIMEIRA abertura grava purchases.firstViewedAt — é o que
//   libera a avaliação do produto (productReviews.ts).
//
// Tamanho e tipo dos arquivos novos vêm dos METADADOS do Storage,
// nunca do app.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { assertAuthenticated, assertSuperAdmin } from '../utils/adminGuard';
import { assertUserNotBlocked } from '../utils/assertUserNotBlocked';
import { createAuditLog } from '../utils/auditLog';
import { notifyAdmins } from '../utils/notifyAdmins';
import { notifyUser } from '../utils/notifyUser';
import {
  ChecklistError, buildRejectionReason, hasChildSafetyRejection, parseProductChecklist,
} from '../config/productChecklist';
import { snapshotProduct, writeProductModerationRecord } from '../moderation/moderationRecords';
import {
  acceptanceContext, assertContractAccepted, assertDeclarationOnFile,
  assertDeclarationVersion, recordProductDeclaration,
} from '../creators/creatorAgreements';
import { PRODUCT_DECLARATION_VERSION } from '../config/creatorAgreement';
import {
  ProductFileEntry, isPendingFile, isActiveForSale, isVisibleToBuyer,
  isAllowedMime, fileTypeFromMime, publicCoverUrl, deleteStorageQuietly,
} from './productFiles';

const db = admin.firestore();

const MAX_DESCRIPTION = 1000;
const MAX_ADDS        = 20;
const MAX_FILES_TOTAL = 100;
const MAX_NAME        = 120;

function assertProductId(value: unknown): string {
  if (typeof value !== 'string' || !value || value.includes('/')) {
    throw new HttpsError('invalid-argument', 'productId obrigatório');
  }
  return value;
}

function assertPathUnder(path: unknown, prefix: string): string {
  if (typeof path !== 'string' || !path.startsWith(prefix) || path.includes('..')) {
    throw new HttpsError('invalid-argument', 'Arquivo inválido.');
  }
  return path;
}
// O Firebase converte `undefined` em `null` na chamada:
// campo não enviado chega como null. Os dois significam "não mexer".
function isProvided(value: unknown): boolean {
  return value !== undefined && value !== null;
}
// ============================================
// EDIÇÃO (criador)
// ============================================
export const submitProductChanges = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;
  await assertUserNotBlocked(uid);

  const data = (request.data ?? {}) as {
    productId?: unknown; description?: unknown;
    addFiles?: unknown; removeFiles?: unknown; newCoverPath?: unknown;
    declarationVersion?: unknown;
  };
  const productId   = assertProductId(data.productId);
  const filesPrefix = `marketplace/products/${productId}/files/`;
  const coverPrefix = `marketplace/products/${productId}/cover/`;
  const bucket      = admin.storage().bucket();

  let description: string | undefined;
  if (isProvided(data.description)) {
    if (typeof data.description !== 'string') throw new HttpsError('invalid-argument', 'Descrição inválida.');
    description = data.description.trim().slice(0, MAX_DESCRIPTION);
  }

  // Arquivos novos: tamanho e tipo dos metadados do Storage.
  const adds: ProductFileEntry[] = [];
  if (isProvided(data.addFiles)) {
    if (!Array.isArray(data.addFiles) || data.addFiles.length > MAX_ADDS) {
      throw new HttpsError('invalid-argument', `Envie até ${MAX_ADDS} arquivos por vez.`);
    }
    for (const raw of data.addFiles as Array<{ storagePath?: unknown; name?: unknown }>) {
      const storagePath = assertPathUnder(raw?.storagePath, filesPrefix);
      let meta: { contentType?: string; size?: string | number };
      try {
        [meta] = await bucket.file(storagePath).getMetadata();
      } catch {
        throw new HttpsError('failed-precondition', 'Um dos arquivos não terminou de enviar. Tente de novo.');
      }
      const mimeType = String(meta.contentType ?? '');
      if (!isAllowedMime(mimeType)) throw new HttpsError('invalid-argument', 'Tipo de arquivo não permitido.');
      const name = typeof raw?.name === 'string' && raw.name.trim()
        ? raw.name.trim().slice(0, MAX_NAME)
        : storagePath.split('/').pop() ?? 'arquivo';
      adds.push({ storagePath, name, mimeType, size: Number(meta.size ?? 0), type: fileTypeFromMime(mimeType) });
    }
  }

  const removes: string[] = [];
  if (isProvided(data.removeFiles)) {
    if (!Array.isArray(data.removeFiles) || data.removeFiles.length > MAX_FILES_TOTAL) {
      throw new HttpsError('invalid-argument', 'Lista de remoção inválida.');
    }
    (data.removeFiles as unknown[]).forEach(p => removes.push(assertPathUnder(p, filesPrefix)));
  }

  let coverPath: string | undefined;
  if (isProvided(data.newCoverPath)) {
    coverPath = assertPathUnder(data.newCoverPath, coverPrefix);
    let meta: { contentType?: string };
    try {
      [meta] = await bucket.file(coverPath).getMetadata();
    } catch {
      throw new HttpsError('failed-precondition', 'A capa não terminou de enviar. Tente de novo.');
    }
    if (!String(meta.contentType ?? '').startsWith('image/')) {
      throw new HttpsError('invalid-argument', 'A capa precisa ser uma imagem.');
    }
  }

  const productRef = db.collection('products').doc(productId);
  const context    = acceptanceContext(request);

  const result = await db.runTransaction(async (t) => {
    const snap = await t.get(productRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Produto não encontrado');
    const product = snap.data()!;

    // Capa ou arquivo novo em produto à venda vai para análise: exige
    // a Declaração do Produto e o contrato vigente. Leituras antes de
    // qualquer gravação (regra das transações).
    const needsDeclaration = product.status === 'approved' && product.ownerId === uid &&
      product.isDeleted !== true && (adds.length > 0 || !!coverPath);
    if (needsDeclaration) {
      assertDeclarationVersion(data.declarationVersion);
      await assertContractAccepted(t, uid);
    }

    if (product.ownerId !== uid) throw new HttpsError('permission-denied', 'Sem permissão para editar este produto.');
    if (product.isDeleted === true) throw new HttpsError('failed-precondition', 'Este produto foi retirado da venda.');
    if (product.status === 'pending') {
      throw new HttpsError('failed-precondition', 'Seu produto está em análise. Aguarde a resposta para editar.');
    }

    const live     = product.status === 'approved';
    const now      = Timestamp.now();
    const files    = [...((product.files ?? []) as ProductFileEntry[])];
    const toDelete: string[] = [];

    for (const path of removes) {
      const idx = files.findIndex(f => f.storagePath === path);
      if (idx === -1) continue;
      const f = files[idx];
      // Nunca vendido (rascunho, rejeitado, ou arquivo ainda em análise): sai de vez.
      if (!live || isPendingFile(f)) {
        files.splice(idx, 1);
        toDelete.push(path);
      } else if (!f.removedAt) {
        files[idx] = { ...f, removedAt: now };
      }
    }

    for (const add of adds) {
      if (files.some(f => f.storagePath === add.storagePath)) continue;
      files.push({ ...add, addedAt: now, ...(live ? { status: 'pending' as const } : {}) });
    }

    if (files.length > MAX_FILES_TOTAL) {
      throw new HttpsError('failed-precondition', `O produto pode ter até ${MAX_FILES_TOTAL} arquivos.`);
    }
    if (live && !files.some(isActiveForSale)) {
      throw new HttpsError('failed-precondition', 'O produto precisa manter pelo menos um arquivo aprovado à venda.');
    }

    const update: Record<string, unknown> = { files, updatedAt: FieldValue.serverTimestamp() };
    if (description !== undefined) update.description = description;

    let pendingCover = product.pendingCover as { storagePath?: string } | undefined;
    if (coverPath) {
      const url = publicCoverUrl(coverPath);
      if (live) {
        if (pendingCover?.storagePath && pendingCover.storagePath !== coverPath) toDelete.push(pendingCover.storagePath);
        pendingCover = { storagePath: coverPath };
        update.pendingCover = { storagePath: coverPath, url, submittedAt: now };
      } else {
        if (product.coverStoragePath && product.coverStoragePath !== coverPath) toDelete.push(product.coverStoragePath);
        update.coverImage       = url;
        update.coverStoragePath = coverPath;
      }
    }

    const pendingNow = live && (files.some(isPendingFile) || !!pendingCover?.storagePath);
    update.hasPendingChanges = pendingNow;

    let declarationId: string | null = null;
    if (needsDeclaration) {
      declarationId = recordProductDeclaration(t, {
        uid,
        productId,
        productTitle: String(product.title ?? ''),
        scope: 'changes',
        fileCount: adds.length,
        coverStoragePath: coverPath ?? null,
        context,
      });
      update.pendingChangesDeclarationId = declarationId;
      update.pendingChangesDeclarationVersion = PRODUCT_DECLARATION_VERSION;
    }

    t.update(productRef, update);

    return {
      toDelete,
      pendingNow,
      becamePending: pendingNow && product.hasPendingChanges !== true,
      title: String(product.title ?? 'Produto'),
      declarationId,
    };
  });

  await deleteStorageQuietly(result.toDelete);

  if (result.becamePending) {
    notifyAdmins({
      title: '✏️ Alterações para analisar',
      body:  `"${result.title}" tem capa ou arquivos novos.`,
      type:  'product_review_new',
      data:  { productId },
    }).catch(() => {});
  }

  createAuditLog({
    action: 'product_changes_submitted',
    performedBy: uid,
    targetId: productId,
    targetType: 'product',
    metadata: {
      description: description !== undefined,
      added: adds.length, removed: removes.length, cover: !!coverPath,
      declarationId: result.declarationId,
    },
    req: request.rawRequest,
  }).catch(() => {});

  return { success: true, pendingReview: result.pendingNow };
});

// ============================================
// MODERAÇÃO DAS ALTERAÇÕES (superadmin)
// ============================================
export const reviewProductChanges = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const adminUid: string = request.auth!.uid;
  await assertSuperAdmin(adminUid);

  const data = (request.data ?? {}) as { productId?: unknown; approve?: unknown; checklist?: unknown };
  const productId = assertProductId(data.productId);
  const approve   = data.approve === true;

  let parsed;
  try {
    parsed = parseProductChecklist(data.checklist);
  } catch (error) {
    if (error instanceof ChecklistError) throw new HttpsError('failed-precondition', error.message);
    throw error;
  }
  if (approve && !parsed.allApproved) {
    throw new HttpsError('failed-precondition', 'Há itens negados no questionário. Para aprovar, todos precisam estar aprovados.');
  }
  if (!approve && parsed.allApproved) {
    throw new HttpsError('failed-precondition', 'Para recusar, marque como negado o item que motivou a recusa.');
  }
  const reason          = approve ? '' : buildRejectionReason(parsed);
  const childSafetyFlag = !approve && hasChildSafetyRejection(parsed);

  const productRef = db.collection('products').doc(productId);

  const result = await db.runTransaction(async (t) => {
    const snap = await t.get(productRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Produto não encontrado');
    const product = snap.data()!;
    if (product.hasPendingChanges !== true) {
      throw new HttpsError('failed-precondition', 'Este produto não tem alterações em análise.');
    }
    // Aprovar exige a declaração das alterações (12/10/2026). Recusar
    // não: a recusa tira do ar o que foi enviado.
    if (approve) {
      await assertDeclarationOnFile(t, String(product.ownerId ?? ''), productId, product.pendingChangesDeclarationId, 'changes');
    }

    const now   = Timestamp.now();
    const files = (product.files ?? []) as ProductFileEntry[];
    const cover = product.pendingCover as { storagePath: string; url: string } | undefined;
    const toDelete: string[] = [];
    const update: Record<string, unknown> = {
      hasPendingChanges: false,
      pendingCover:      FieldValue.delete(),
      pendingChangesDeclarationId:      FieldValue.delete(),
      pendingChangesDeclarationVersion: FieldValue.delete(),
      updatedAt:         FieldValue.serverTimestamp(),
    };

    if (approve) {
      update.files = files.map(f => (isPendingFile(f) ? { ...f, status: 'approved', approvedAt: now } : f));
      if (cover) {
        if (product.coverStoragePath && product.coverStoragePath !== cover.storagePath) toDelete.push(product.coverStoragePath);
        update.coverImage       = cover.url;
        update.coverStoragePath = cover.storagePath;
      }
      update.version = FieldValue.increment(1);
    } else {
      files.filter(isPendingFile).forEach(f => toDelete.push(f.storagePath));
      update.files = files.filter(f => !isPendingFile(f));
      if (cover) toDelete.push(cover.storagePath);
      update.lastChangesRejection = { reason, at: now };
    }

    t.update(productRef, update);

    const recordId = writeProductModerationRecord(t, {
      type:            'product_changes',
      productId,
      ownerId:         String(product.ownerId ?? ''),
      reviewerUid:     adminUid,
      checklist:       parsed,
      outcome:         approve ? 'approved' : 'rejected',
      reason:          approve ? null : reason,
      childSafetyFlag,
      snapshot:        snapshotProduct(product, { onlyPendingFiles: true, pendingCoverPath: cover?.storagePath ?? null }),
    });

    return { toDelete, recordId, ownerId: String(product.ownerId), title: String(product.title ?? 'Seu produto') };
  });

  // Recusa por proteção de menores: os arquivos FICAM guardados como
  // prova (fora da venda — já saíram da lista do produto).
  if (!childSafetyFlag) {
    await deleteStorageQuietly(result.toDelete);
  } else {
    console.warn('[reviewProductChanges] alerta de proteção de menores', JSON.stringify({
      productId, ownerId: result.ownerId, moderationRecordId: result.recordId, kept: result.toDelete,
    }));
    notifyAdmins({
      title: '🚨 Proteção de menores',
      body:  `Alterações de "${result.title}" recusadas por item de proteção de menores. Revise a conta do criador.`,
      type:  'child_safety_alert',
      data:  { productId, ownerId: result.ownerId },
    }).catch(() => {});
  }

  notifyUser({
    userId: result.ownerId,
    title:  approve ? '✅ Alterações aprovadas' : 'Alterações não aprovadas',
    body:   approve
      ? `As novidades de "${result.title}" já estão disponíveis.`
      : `"${result.title}" precisa de ajustes:\n${reason}`,
    type:   'product_approved',
    data:   { productId },
  }).catch(() => {});

  await createAuditLog({
    action: approve ? 'product_changes_approved' : 'product_changes_rejected',
    performedBy: adminUid,
    targetId: productId,
    targetType: 'product',
    metadata: {
      reason: approve ? null : reason,
      moderationRecordId: result.recordId,
      rejectedItems: parsed.rejectedIds,
      childSafetyFlag,
    },
    req: request.rawRequest,
  });

  return { success: true };
});

// ============================================
// TIRAR DA VENDA (criador)
// ============================================
export const unpublishProduct = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;

  const productId  = assertProductId((request.data ?? {}).productId);
  const productRef = db.collection('products').doc(productId);

  const pending = await db.runTransaction(async (t) => {
    const snap = await t.get(productRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Produto não encontrado');
    const product = snap.data()!;
    if (product.ownerId !== uid) throw new HttpsError('permission-denied', 'Sem permissão.');
    if (product.isDeleted === true) return [] as string[];

    const files = (product.files ?? []) as ProductFileEntry[];
    const cover = product.pendingCover as { storagePath?: string } | undefined;
    const paths = files.filter(isPendingFile).map(f => f.storagePath);
    if (cover?.storagePath) paths.push(cover.storagePath);

    t.update(productRef, {
      isDeleted:         true,
      deletedAt:         FieldValue.serverTimestamp(),
      isFeatured:        false,
      hasPendingChanges: false,
      pendingCover:      FieldValue.delete(),
      pendingChangesDeclarationId:      FieldValue.delete(),
      pendingChangesDeclarationVersion: FieldValue.delete(),
      files:             files.filter(f => !isPendingFile(f)),
      updatedAt:         FieldValue.serverTimestamp(),
    });
    return paths;
  });

  // O que nunca foi aprovado sai sempre. O resto só se ninguém comprou.
  await deleteStorageQuietly(pending);

  const sold = (await db.collection('purchases').where('productId', '==', productId).count().get()).data().count;
  if (sold === 0) {
    await admin.storage().bucket()
      .deleteFiles({ prefix: `marketplace/products/${productId}/` })
      .catch(error => console.warn('[unpublishProduct] limpeza falhou:', error));
  }

  createAuditLog({
    action: 'product_unpublished',
    performedBy: uid,
    targetId: productId,
    targetType: 'product',
    metadata: { keptForBuyers: sold > 0, buyers: sold },
    req: request.rawRequest,
  }).catch(() => {});

  return { success: true, keptForBuyers: sold > 0 };
});

// ============================================
// CONTEÚDO DE UMA COMPRA (comprador)
// ============================================
export const getPurchasedContent = onCall(async (request) => {
  assertAuthenticated(request.auth?.uid);
  const uid: string = request.auth!.uid;
  await assertUserNotBlocked(uid);

  const productId = assertProductId((request.data ?? {}).productId);

  const [purchaseSnap, productSnap] = await Promise.all([
    db.collection('purchases').doc(`${uid}_${productId}`).get(),
    db.collection('products').doc(productId).get(),
  ]);

  const purchase = purchaseSnap.data();
  if (!purchase || purchase.buyerId !== uid || purchase.status !== 'active' || purchase.isRevoked === true) {
    throw new HttpsError('permission-denied', 'Você não tem acesso a este conteúdo.');
  }
  const product = productSnap.data();
  if (!product) throw new HttpsError('not-found', 'Produto não encontrado');

  // Primeira visualização: libera a avaliação. Só grava quando o
  // campo ainda não existe — uma gravação na vida da compra. Falha
  // aqui não pode impedir o comprador de ver o que pagou.
  if (!purchase.firstViewedAt) {
    await purchaseSnap.ref
      .update({ firstViewedAt: FieldValue.serverTimestamp() })
      .catch(error => console.warn('[getPurchasedContent] firstViewedAt falhou:', error));
  }

  const purchasedAt = (purchase.createdAt as Timestamp | undefined)?.toDate() ?? null;
  const files = ((product.files ?? []) as ProductFileEntry[])
    .filter(f => isVisibleToBuyer(f, purchasedAt))
    .map(f => ({ storagePath: f.storagePath, name: f.name, size: f.size, mimeType: f.mimeType, type: f.type }));

  return { title: String(product.title ?? 'Conteúdo'), files };
});

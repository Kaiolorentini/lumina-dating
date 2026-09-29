// ============================================
// PRODUCT SERVICE — MARKETPLACE
//
// Responsabilidades:
// - CRUD de produtos (draft/pending/approved/rejected)
// - Upload com cancelamento + retry exponencial
// - Cleanup de Storage ao excluir
// - Distributed counters para views (5 shards)
// - Audit logging em todas as operações
//
// NÃO incluí: aprovação (Cloud Function — FASE 6)
// NÃO usa getDownloadURL() para arquivos pagos
// ============================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  serverTimestamp,
  DocumentSnapshot,
  QueryConstraint,
  documentId,
  Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import app, { db, storage } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS } from '../../core/constants';
import {
  Product,
  ProductStatus,
  ProductCategory,
  ProductFileType,
  ProductFile,
} from '../../shared/types/marketplace';
import { createAuditLog } from './auditService';
// notifySuperAdmins do cliente REMOVIDO: ele lia a lista de
// superadmins do appSettings/adminConfig (público nas rules) e
// depois o pushToken deles na coleção users. O trigger
// onProductPending, no backend, já notifica os admins quando o
// produto entra em revisão — era chamada duplicada.

// ============================================
// UPLOAD TYPES
// ============================================

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

export interface UploadHandle {
  promise: Promise<{ downloadURL?: string; storagePath: string }>;
  cancel: () => void;
}

// ============================================
// UPLOAD INTERNALS
// ============================================

function getExtension(uri: string): string {
  const clean = uri.split('?')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : 'bin';
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

function createUploadHandle(
  storagePath: string,
  blob: Blob,
  fetchDownloadURL: boolean,
  onProgress?: (p: UploadProgress) => void,
): UploadHandle {
  let cancelled = false;
  let currentTask: ReturnType<typeof uploadBytesResumable> | null = null;
  const MAX_ATTEMPTS = 3;

  const promise = (async (): Promise<{ downloadURL?: string; storagePath: string }> => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (cancelled) throw new Error('Upload cancelado pelo usuário');

      try {
        const result = await new Promise<{ downloadURL?: string; storagePath: string }>(
          (resolve, reject) => {
            const storageRef = ref(storage, storagePath);
            currentTask = uploadBytesResumable(storageRef, blob);

            currentTask.on(
              'state_changed',
              snapshot => {
                if (onProgress) {
                  onProgress({
                    bytesTransferred: snapshot.bytesTransferred,
                    totalBytes: snapshot.totalBytes,
                    percentage:
                      snapshot.totalBytes > 0
                        ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
                        : 0,
                  });
                }
              },
              error => {
                if ((error as { code?: string }).code === 'storage/canceled') {
                  reject(new Error('CANCELLED'));
                } else {
                  reject(error);
                }
              },
              async () => {
                try {
                  const finalPath = currentTask!.snapshot.ref.fullPath;
                  if (fetchDownloadURL) {
                    const downloadURL = await getDownloadURL(currentTask!.snapshot.ref);
                    resolve({ downloadURL, storagePath: finalPath });
                  } else {
                    resolve({ storagePath: finalPath });
                  }
                } catch (e) {
                  reject(e);
                }
              },
            );
          },
        );

        return result;
      } catch (error: unknown) {
        const err = error as { message?: string };
        if (err.message === 'CANCELLED' || cancelled) {
          throw new Error('Upload cancelado pelo usuário');
        }
        if (attempt === MAX_ATTEMPTS) {
          throw new Error(`Upload falhou após ${MAX_ATTEMPTS} tentativas: ${err.message}`);
        }
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
    throw new Error('Upload falhou');
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      currentTask?.cancel();
    },
  };
}

// ============================================
// UPLOADS PÚBLICOS (capa + previews)
// ============================================

export async function uploadProductCover(
  productId: string,
  uri: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<UploadHandle> {
  const ext = getExtension(uri);
  // Nome único: as regras do Storage só permitem CRIAR — sobrescrever
  // trocaria a capa aprovada sem moderação.
  const storagePath = `marketplace/products/${productId}/cover/cover_${Date.now()}.${ext}`;
  const blob = await uriToBlob(uri);
  return createUploadHandle(storagePath, blob, true, onProgress);
}

export async function uploadProductPreview(
  productId: string,
  uri: string,
  index: number,
  onProgress?: (p: UploadProgress) => void,
): Promise<UploadHandle> {
  const ext = getExtension(uri);
  const storagePath = `marketplace/products/${productId}/previews/preview_${index}.${ext}`;
  const blob = await uriToBlob(uri);
  return createUploadHandle(storagePath, blob, true, onProgress);
}

export async function uploadProductPreviewFile(
  productId: string,
  uri: string,
  fileName: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<UploadHandle> {
  const storagePath = `marketplace/products/${productId}/previewFiles/${fileName}`;
  const blob = await uriToBlob(uri);
  return createUploadHandle(storagePath, blob, true, onProgress);
}

// ============================================
// UPLOAD PAGO (arquivo digital — SEM downloadURL)
// ============================================

export async function uploadProductFile(
  productId: string,
  uri: string,
  fileName: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<UploadHandle> {
  // Nome único pelo mesmo motivo da capa: reenviar "foto.jpg" trocaria
  // o arquivo aprovado que os compradores já têm.
  const safeName = fileName.replace(/[^\w.\-]+/g, '_').slice(-80);
  const storagePath = `marketplace/products/${productId}/files/${Date.now()}_${safeName}`;
  const blob = await uriToBlob(uri);
  return createUploadHandle(storagePath, blob, false, onProgress);
}

// ============================================
// A limpeza de Storage saiu do app (28/09): apagar arquivos de um
// produto vendido tirava de quem comprou o que foi pago. Quem decide
// o que pode ser apagado é o servidor (unpublishProduct).
// ============================================

// ============================================
// CRUD
// ============================================

export async function createProduct(
  ownerId: string,
  data: {
    title: string;
    description: string;
    price: number;
    category: ProductCategory;
    tags?: string[];
  },
): Promise<string> {
  const docRef = await addDoc(collection(db, MARKETPLACE_COLLECTIONS.PRODUCTS), {
    ownerId,
    title: data.title,
    description: data.description,
    price: data.price,
    isFree: data.price === 0,
    category: data.category,
    tags: data.tags ?? [],
    status: 'draft' as ProductStatus,
    coverImage: '',
    previewImages: [],
    previewFiles: [],
    files: [],
    isFeatured: false,
    isDeleted: false,
    averageRating: 0,
    reviewsCount: 0,
    version: 1,
    changelog: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Audit — fire-and-forget, nunca bloqueia o fluxo principal
  createAuditLog({
    action: 'product_created',
    performedBy: ownerId,
    targetId: docRef.id,
    targetType: 'product',
    metadata: { title: data.title, category: data.category, price: data.price },
  }).catch(() => {});

  return docRef.id;
}

export async function updateProduct(
  productId: string,
  ownerId: string,
  updates: Partial<{
    title: string;
    description: string;
    price: number;
    category: ProductCategory;
    tags: string[];
    coverImage: string;
    previewImages: string[];
    previewFiles: string[];
    files: Array<{
      storagePath: string;
      type: ProductFileType;
      name: string;
      size: number;
      mimeType: string;
    }>;
    changelog: string;
  }>,
): Promise<void> {
  const productRef = doc(db, MARKETPLACE_COLLECTIONS.PRODUCTS, productId);
  const snap = await getDoc(productRef);

  if (!snap.exists()) throw new Error('Produto não encontrado');
  if (snap.data().ownerId !== ownerId) throw new Error('Sem permissão para editar este produto');
  if (!['draft', 'rejected'].includes(snap.data().status)) {
    throw new Error('Produto só pode ser editado com status draft ou rejected');
  }

  const updateData: Record<string, unknown> = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  if (updates.price !== undefined) {
    updateData.isFree = updates.price === 0;
  }

  await updateDoc(productRef, updateData);

  // Audit — fire-and-forget
  createAuditLog({
    action: 'product_updated',
    performedBy: ownerId,
    targetId: productId,
    targetType: 'product',
    metadata: { fields: Object.keys(updates) },
  }).catch(() => {});
}

export async function submitProductForReview(
  productId: string,
  ownerId: string,
): Promise<void> {
  const productRef = doc(db, MARKETPLACE_COLLECTIONS.PRODUCTS, productId);
  const snap = await getDoc(productRef);

  if (!snap.exists()) throw new Error('Produto não encontrado');
  if (snap.data().ownerId !== ownerId) throw new Error('Sem permissão');
  if (!['draft', 'rejected'].includes(snap.data().status)) {
    throw new Error('Produto já está em revisão ou aprovado');
  }
  if (!snap.data().coverImage) throw new Error('Adicione uma capa antes de enviar');
  if (!snap.data().files?.length) throw new Error('Adicione pelo menos um arquivo antes de enviar');

  await updateDoc(productRef, {
    status: 'pending' as ProductStatus,
    updatedAt: serverTimestamp(),
  });

  // Audit e notificação — fire-and-forget
  createAuditLog({
    action: 'product_submitted_for_review',
    performedBy: ownerId,
    targetId: productId,
    targetType: 'product',
    metadata: { title: snap.data().title },
  }).catch(() => {});

}

/** Mantido pela assinatura antiga: agora tira da venda pelo servidor. */
export async function softDeleteProduct(productId: string, _ownerId?: string): Promise<void> {
  await unpublishProduct(productId);
}

export async function getProduct(productId: string): Promise<Product | null> {
  const snap = await getDoc(doc(db, MARKETPLACE_COLLECTIONS.PRODUCTS, productId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Product;
}

export async function getProducts(filters: {
  status?: ProductStatus;
  category?: string;
  ownerId?: string;
  isFeatured?: boolean;
  pageSize?: number;
  lastDoc?: DocumentSnapshot | null;
}): Promise<{ products: Product[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const {
    status,
    category,
    ownerId,
    isFeatured,
    pageSize = 20,
    lastDoc = null,
  } = filters;

  const constraints: QueryConstraint[] = [
    where('isDeleted', '==', false),
  ];

  // Se ownerId passado sem status → mostra todos os status do dono (draft, pending, approved, rejected)
  // Se sem ownerId → filtra por approved por padrão (marketplace público)
  if (status) {
    constraints.push(where('status', '==', status));
  } else if (!ownerId) {
    constraints.push(where('status', '==', 'approved'));
  }

  if (ownerId)    constraints.push(where('ownerId', '==', ownerId));
  if (category)   constraints.push(where('category', '==', category));
  if (isFeatured !== undefined) constraints.push(where('isFeatured', '==', isFeatured));

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(pageSize + 1));

  if (lastDoc) constraints.push(startAfter(lastDoc));

  const snapshot = await getDocs(
    query(collection(db, MARKETPLACE_COLLECTIONS.PRODUCTS), ...constraints),
  );

  const hasMore  = snapshot.docs.length > pageSize;
  const docs     = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
  const products = docs.map(d => ({ id: d.id, ...d.data() } as Product));
  const newLastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

  return { products, lastDoc: newLastDoc, hasMore };
}

// ============================================
// DISTRIBUTED COUNTER — VIEWS (5 shards)
// ============================================

const SHARD_COUNT = 5;

export async function incrementProductViews(productId: string): Promise<void> {
  try {
    const shardId  = Math.floor(Math.random() * SHARD_COUNT).toString();
    const shardRef = doc(
      db,
      MARKETPLACE_COLLECTIONS.PRODUCT_ANALYTICS,
      productId,
      'shards',
      shardId,
    );
    try {
      await updateDoc(shardRef, { views: increment(1) });
    } catch {
      await setDoc(shardRef, { views: 1, downloads: 0, favorites: 0 }, { merge: true });
    }
  } catch {
    // Views não são críticos — falha silenciosa
  }
}

export async function getProductTotalViews(productId: string): Promise<number> {
  try {
    const shardsRef = collection(
      db,
      MARKETPLACE_COLLECTIONS.PRODUCT_ANALYTICS,
      productId,
      'shards',
    );
    const snapshot = await getDocs(shardsRef);
    return snapshot.docs.reduce((total, d) => total + (d.data().views ?? 0), 0);
  } catch {
    return 0;
  }
}
// ============================================
// BUSCA EM LOTE — evita N+1 em telas de listagem
//
// where(documentId(), 'in', [...]) aceita no máximo 30 ids por
// query. Uma página de 20 favoritos vira 1 leitura em vez de 20.
// Produtos ausentes (deletados) simplesmente não voltam — o
// chamador decide como exibir a lacuna.
// ============================================

export async function getProductsByIds(productIds: string[]): Promise<Map<string, Product>> {
  const result = new Map<string, Product>();
  if (productIds.length === 0) return result;

  const CHUNK_SIZE = 30;
  const chunks: string[][] = [];
  for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
    chunks.push(productIds.slice(i, i + CHUNK_SIZE));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, MARKETPLACE_COLLECTIONS.PRODUCTS),
            where(documentId(), 'in', chunk),
          ),
        );
        snapshot.docs.forEach((d) => {
          result.set(d.id, { id: d.id, ...d.data() } as Product);
        });
      } catch (e) {
        console.error('[getProductsByIds] chunk failed:', e);
      }
    }),
  );

  return result;
}

// ============================================
// EDIÇÃO E ALTERAÇÕES EM ANÁLISE (28/09)
// ============================================

/** Arquivo com os campos de moderação gravados pelo servidor. */
export interface ProductFileWithStatus extends ProductFile {
  /** 'pending' = esperando o admin. Sem o campo = aprovado. */
  status?: 'approved' | 'pending';
  addedAt?: Timestamp;
  /** Removido pelo criador: só quem comprou antes continua vendo. */
  removedAt?: Timestamp;
}

export type ProductWithChanges = Omit<Product, 'files'> & {
  files?: ProductFileWithStatus[];
  hasPendingChanges?: boolean;
  pendingCover?: { storagePath: string; url: string };
  lastChangesRejection?: { reason: string };
};

function fns() {
  return getFunctions(app, 'us-central1');
}

export async function submitProductChanges(input: {
  productId: string;
  description?: string;
  addFiles?: Array<{ storagePath: string; name: string }>;
  removeFiles?: string[];
  newCoverPath?: string;
}): Promise<{ pendingReview: boolean }> {
  const result = await httpsCallable<typeof input, { pendingReview: boolean }>(fns(), 'submitProductChanges')(input);
  return result.data;
}

/** Tira da venda. Quem comprou mantém o acesso. */
export async function unpublishProduct(productId: string): Promise<{ keptForBuyers: boolean }> {
  const result = await httpsCallable<{ productId: string }, { keptForBuyers: boolean }>(
    fns(), 'unpublishProduct',
  )({ productId });
  return result.data;
}

export interface PurchasedContent {
  title: string;
  files: Array<{ storagePath: string; name: string; size: number; mimeType: string; type: string }>;
}

/** Arquivos que ESTA compra pode ver (sem os em análise e os removidos depois dela). */
export async function getPurchasedContent(productId: string): Promise<PurchasedContent> {
  const result = await httpsCallable<{ productId: string }, PurchasedContent>(
    fns(), 'getPurchasedContent',
  )({ productId });
  return result.data;
}

/**
 * Produtos das compras do usuário, um get por produto. O get tem regra
 * própria para quem comprou — funciona com produto tirado da venda, que
 * a consulta em lote (list) não alcança. O número de leituras é o mesmo.
 */
export async function getProductsForPurchases(productIds: string[]): Promise<Map<string, Product>> {
  const result = new Map<string, Product>();
  const unique = Array.from(new Set(productIds.filter(Boolean)));
  const snaps = await Promise.all(
    unique.map(id => getDoc(doc(db, MARKETPLACE_COLLECTIONS.PRODUCTS, id)).catch(() => null)),
  );
  snaps.forEach(snap => {
    if (snap?.exists()) result.set(snap.id, { id: snap.id, ...snap.data() } as Product);
  });
  return result;
}

/** Fila "Alterações" da moderação. Índice: products (hasPendingChanges, updatedAt DESC). */
export async function getProductsWithPendingChanges(pageSize = 20): Promise<Product[]> {
  const snap = await getDocs(query(
    collection(db, MARKETPLACE_COLLECTIONS.PRODUCTS),
    where('hasPendingChanges', '==', true),
    orderBy('updatedAt', 'desc'),
    limit(pageSize),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
}
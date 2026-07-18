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
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
import { db, storage } from '../../core/firebase';
import { MARKETPLACE_COLLECTIONS } from '../../core/constants';
import {
  Product,
  ProductStatus,
  ProductCategory,
  ProductFileType,
} from '../../shared/types/marketplace';
import { createAuditLog } from './auditService';
import { notifySuperAdmins } from './pushAdminService';

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
  const storagePath = `marketplace/products/${productId}/cover/cover.${ext}`;
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
  const storagePath = `marketplace/products/${productId}/files/${fileName}`;
  const blob = await uriToBlob(uri);
  return createUploadHandle(storagePath, blob, false, onProgress);
}

// ============================================
// STORAGE CLEANUP
// ============================================

async function deleteProductStorage(productId: string): Promise<void> {
  const folders = ['cover', 'previews', 'previewFiles', 'files'];
  for (const folder of folders) {
    try {
      const folderRef = ref(storage, `marketplace/products/${productId}/${folder}`);
      const { items } = await listAll(folderRef);
      await Promise.allSettled(items.map(item => deleteObject(item)));
    } catch {
      // Pasta pode não existir — continua
    }
  }
}

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

  notifySuperAdmins(
    '📦 Novo produto para moderação',
    `"${snap.data().title}" aguarda revisão`,
    { type: 'product_review_new', productId, ownerId },
  ).catch(() => {});
}

export async function softDeleteProduct(
  productId: string,
  ownerId: string,
): Promise<void> {
  const productRef = doc(db, MARKETPLACE_COLLECTIONS.PRODUCTS, productId);
  const snap = await getDoc(productRef);

  if (!snap.exists()) throw new Error('Produto não encontrado');
  if (snap.data().ownerId !== ownerId) throw new Error('Sem permissão');

  await deleteProductStorage(productId);

  await updateDoc(productRef, {
    isDeleted: true,
    updatedAt: serverTimestamp(),
  });

  // Audit — fire-and-forget
  createAuditLog({
    action: 'product_deleted',
    performedBy: ownerId,
    targetId: productId,
    targetType: 'product',
    metadata: { title: snap.data().title },
  }).catch(() => {});
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
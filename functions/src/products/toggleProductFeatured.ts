// ============================================
// LUMINA — DESTACAR PRODUTO NO MARKETPLACE
// functions/src/products/toggleProductFeatured.ts
//
// isFeatured controla o carrossel da home do marketplace —
// espaço de curadoria, não de auto-serviço. A firestore.rules
// proíbe o criador de escrever nesse campo, então a alteração
// tem que passar por aqui.
//
// Só superadmin: destacar é decisão editorial e afeta receita.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createAuditLog } from '../utils/auditLog';

export const toggleProductFeatured = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const { productId, isFeatured } = request.data as {
      productId: string;
      isFeatured: boolean;
    };

    if (!productId) throw new HttpsError('invalid-argument', 'productId obrigatório.');
    if (typeof isFeatured !== 'boolean') {
      throw new HttpsError('invalid-argument', 'isFeatured deve ser booleano.');
    }

    const db = admin.firestore();

    // Verifica superadmin server-side — nunca confia no cliente.
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.data()?.role !== 'superadmin') {
      throw new HttpsError('permission-denied', 'Acesso restrito a superadmins.');
    }

    const productRef = db.collection('products').doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) throw new HttpsError('not-found', 'Produto não encontrado.');

    const product = productSnap.data()!;

    // Só produto aprovado e ativo pode ir para a vitrine. Sem esta
    // checagem daria para destacar um rascunho ou um produto
    // excluído — que o carrossel não mostraria, gerando a impressão
    // de que o destaque não funciona.
    if (isFeatured) {
      if (product.status !== 'approved') {
        throw new HttpsError(
          'failed-precondition',
          'Só produtos aprovados podem ser destacados.',
        );
      }
      if (product.isDeleted === true) {
        throw new HttpsError('failed-precondition', 'Produto excluído não pode ser destacado.');
      }
    }

    await productRef.update({
      isFeatured,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    createAuditLog({
      action: isFeatured ? 'product_featured' : 'product_unfeatured',
      performedBy: uid,
      targetId: productId,
      targetType: 'product',
      metadata: { title: product.title, ownerId: product.ownerId },
      req: request.rawRequest,
    }).catch(() => {});

    return { success: true, isFeatured };
  }
);
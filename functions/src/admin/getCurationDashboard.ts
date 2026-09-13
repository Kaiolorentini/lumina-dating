// ============================================
// LUMINA — DADOS DA CURADORIA DO MARKETPLACE
// functions/src/admin/getCurationDashboard.ts
//
// Devolve o que o superadmin precisa para decidir o que colocar
// no carrossel: o que já está destacado e o que mais vende.
//
// A contagem de vendas é feita AQUI e não no cliente porque
// exige varrer a collection sales — que o app não pode ler
// inteira (e nem deveria).
//
// ESCALA: com poucas centenas de sales a agregação em memória
// é adequada. Passando disso, o caminho é desnormalizar um
// campo salesCount no produto, incrementado pelo webhook.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

interface CurationProduct {
  id:            string;
  title:         string;
  category:      string;
  price:         number;
  isFree:        boolean;
  coverImage:    string;
  ownerId:       string;
  isFeatured:    boolean;
  averageRating: number;
  salesCount:    number;
  revenue:       number;
}

export const getCurationDashboard = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Não autenticado.');

    const db = admin.firestore();

    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.data()?.role !== 'superadmin') {
      throw new HttpsError('permission-denied', 'Acesso restrito a superadmins.');
    }

    // 1. Produtos aprovados e ativos — só eles podem ser destacados.
    const productsSnap = await db.collection('products')
      .where('isDeleted', '==', false)
      .where('status', '==', 'approved')
      .get();

    // 2. Vendas pagas, agregadas por produto.
    const salesSnap = await db.collection('sales')
      .where('status', '==', 'paid')
      .get();

    const salesByProduct = new Map<string, { count: number; revenue: number }>();
    salesSnap.forEach(doc => {
      const s = doc.data();
      // Compra de cristais não tem productId — não entra aqui.
      if (!s.productId) return;
      const cur = salesByProduct.get(s.productId) ?? { count: 0, revenue: 0 };
      cur.count   += 1;
      cur.revenue += s.finalAmount ?? s.amount ?? 0;
      salesByProduct.set(s.productId, cur);
    });

    const products: CurationProduct[] = productsSnap.docs.map(doc => {
      const p = doc.data();
      const agg = salesByProduct.get(doc.id) ?? { count: 0, revenue: 0 };
      return {
        id:            doc.id,
        title:         p.title ?? 'Sem título',
        category:      p.category ?? 'outros',
        price:         p.price ?? 0,
        isFree:        p.isFree === true || p.price === 0,
        coverImage:    p.coverImage ?? '',
        ownerId:       p.ownerId ?? '',
        isFeatured:    p.isFeatured === true,
        averageRating: p.averageRating ?? 0,
        salesCount:    agg.count,
        revenue:       Math.round(agg.revenue * 100) / 100,
      };
    });

    const featured = products.filter(p => p.isFeatured);

    // Top vendidos: só quem tem venda. Um produto sem venda no
    // topo de "mais vendidos" seria ruído.
    const topSelling = products
      .filter(p => p.salesCount > 0)
      .sort((a, b) => b.salesCount - a.salesCount || b.revenue - a.revenue)
      .slice(0, 10);

    return {
      featured,
      topSelling,
      totals: {
        approvedProducts: products.length,
        featuredCount:    featured.length,
        productsWithSales: products.filter(p => p.salesCount > 0).length,
      },
    };
  }
);
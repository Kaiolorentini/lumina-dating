// ============================================
// useCreatorProducts — HOOK
// src/hooks/useCreatorProducts.ts
//
// Produtos À VENDA de um criador, para o perfil dele (Kaio,
// 08/10/2026: todos os produtos, numa faixa horizontal que carrega
// aos poucos). Usa o getProducts do marketplace — mesma regra de
// vitrine: só aprovados e não retirados da venda.
//
// Custo: nada é buscado com enabled=false (perfil que não é de
// criador). Com enabled, 1 consulta de PAGE_SIZE + 1 documentos e
// mais uma a cada "fim da faixa".
//
// Índice: products (isDeleted, status, ownerId, createdAt DESC).
// Protegido contra resposta atrasada: troca de perfil no meio da
// busca não mistura produtos de duas pessoas.
// ============================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import { getProducts } from '../services/marketplace/productService';
import { Product } from '../shared/types/marketplace';

const PAGE_SIZE = 10;

interface UseCreatorProductsReturn {
  products: Product[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCreatorProducts(
  ownerId: string | undefined,
  enabled: boolean,
): UseCreatorProductsReturn {
  const [products, setProducts]       = useState<Product[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const mountedRef   = useRef(true);
  const requestIdRef = useRef(0);
  const lastDocRef   = useRef<DocumentSnapshot | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchFirst = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    lastDocRef.current = null;

    if (!enabled || !ownerId) {
      setProducts([]);
      setHasMore(false);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const page = await getProducts({ status: 'approved', ownerId, pageSize: PAGE_SIZE });
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setProducts(page.products);
      setHasMore(page.hasMore);
      lastDocRef.current = page.lastDoc;
    } catch (e) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      console.error('[useCreatorProducts] falhou:', e);
      setError('Não foi possível carregar os conteúdos.');
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setLoading(false);
    }
  }, [ownerId, enabled]);

  const loadMore = useCallback(async () => {
    if (!enabled || !ownerId || loading || loadingMore || !hasMore || !lastDocRef.current) return;
    const requestId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const page = await getProducts({
        status: 'approved', ownerId, pageSize: PAGE_SIZE, lastDoc: lastDocRef.current,
      });
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setProducts(prev => {
        // Sem duplicar se a mesma página chegar duas vezes.
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...page.products.filter(p => !seen.has(p.id))];
      });
      setHasMore(page.hasMore);
      lastDocRef.current = page.lastDoc;
    } catch (e) {
      // Falha ao carregar MAIS não apaga o que já está na tela;
      // o próximo fim da faixa tenta de novo.
      console.warn('[useCreatorProducts] loadMore falhou:', e);
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setLoadingMore(false);
    }
  }, [ownerId, enabled, loading, loadingMore, hasMore]);

  useEffect(() => { fetchFirst(); }, [fetchFirst]);

  return { products, loading, loadingMore, hasMore, error, loadMore, refresh: fetchFirst };
}

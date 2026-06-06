// ============================================
// useProducts — HOOK
//
// Listagem paginada com filtros.
// Protegido: mountedRef + requestIdRef.
// Paginação: startAfter(lastDocument).
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import { getProducts } from '../services/marketplace/productService';
import { Product, ProductStatus, ProductCategory } from '../shared/types/marketplace';

interface UseProductsFilters {
  status?: ProductStatus;
  category?: ProductCategory;
  ownerId?: string;
  isFeatured?: boolean;
  pageSize?: number;
}

interface UseProductsReturn {
  products: Product[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useProducts(filters: UseProductsFilters = {}): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);

  const filtersKey = JSON.stringify(filters);

  const fetchFirst = useCallback(async () => {
    if (!mountedRef.current) return;

    const thisRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    lastDocRef.current = null;

    try {
      const result = await getProducts({ ...filters, lastDoc: null });

      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;

      setProducts(result.products);
      setHasMore(result.hasMore);
      lastDocRef.current = result.lastDoc;
    } catch (e: any) {
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
      setError(e.message ?? 'Erro ao carregar produtos');
    } finally {
      if (mountedRef.current && thisRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [filtersKey]);

  const loadMore = useCallback(async () => {
    if (!mountedRef.current || loadingMore || !hasMore || !lastDocRef.current) return;

    const thisRequestId = ++requestIdRef.current;
    setLoadingMore(true);

    try {
      const result = await getProducts({ ...filters, lastDoc: lastDocRef.current });

      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;

      setProducts(prev => [...prev, ...result.products]);
      setHasMore(result.hasMore);
      lastDocRef.current = result.lastDoc;
    } catch (e: any) {
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
      setError(e.message ?? 'Erro ao carregar mais produtos');
    } finally {
      if (mountedRef.current && thisRequestId === requestIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [filtersKey, loadingMore, hasMore]);

  useEffect(() => {
    mountedRef.current = true;
    fetchFirst();

    return () => {
      mountedRef.current = false;
    };
  }, [filtersKey]);

  return { products, loading, loadingMore, hasMore, error, loadMore, refresh: fetchFirst };
}
import { useState, useEffect, useRef, useCallback } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import { getFavoriteProducts, removeFavorite } from '../services/marketplace/favoritesService';

export interface FavoriteProductDisplayItem {
  productId: string;
  title: string;
  coverImage: string;
  ownerId: string;
  favoritedAt: Date | null;
}

interface UseFavoriteProductsReturn {
  items: FavoriteProductDisplayItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  remove: (productId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFavoriteProducts(
  uid: string | undefined,
  pageSize = 20,
): UseFavoriteProductsReturn {
  const [items, setItems] = useState<FavoriteProductDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);
  const currentUidRef = useRef<string | undefined>(uid);

  const fetchFirst = useCallback(async () => {
    if (!mountedRef.current || !uid) {
      setLoading(false);
      return;
    }

    const thisRequestId = ++requestIdRef.current;
    const capturedUid = uid;
    setLoading(true);
    setError(null);
    lastDocRef.current = null;

    try {
      const result = await getFavoriteProducts(capturedUid, pageSize, null);

      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
      if (currentUidRef.current !== capturedUid) return;

      setItems(result.items.map(f => ({
        productId: f.productId,
        title: f.product?.title ?? 'Produto removido',
        coverImage: f.product?.coverImage ?? '',
        ownerId: f.product?.ownerId ?? '',
        favoritedAt: f.favoritedAt?.toDate() ?? null,
      })));
      setHasMore(result.hasMore);
      lastDocRef.current = result.lastDoc;
    } catch (e: any) {
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
      console.error('[useFavoriteProducts] fetchFirst error:', e.code, e.message);
      setError(e.message ?? 'Erro ao carregar favoritos');
    } finally {
      if (mountedRef.current && thisRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [uid, pageSize]);

  const loadMore = useCallback(async () => {
    if (!mountedRef.current || loadingMore || !hasMore || !lastDocRef.current || !uid) return;

    const thisRequestId = ++requestIdRef.current;
    setLoadingMore(true);

    try {
      const result = await getFavoriteProducts(uid, pageSize, lastDocRef.current);
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;

      setItems(prev => [...prev, ...result.items.map(f => ({
        productId: f.productId,
        title: f.product?.title ?? 'Produto removido',
        coverImage: f.product?.coverImage ?? '',
        ownerId: f.product?.ownerId ?? '',
        favoritedAt: f.favoritedAt?.toDate() ?? null,
      }))]);
      setHasMore(result.hasMore);
      lastDocRef.current = result.lastDoc;
    } catch (e: any) {
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
      setError(e.message ?? 'Erro ao carregar mais favoritos');
    } finally {
      if (mountedRef.current && thisRequestId === requestIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [uid, pageSize, loadingMore, hasMore]);

  const remove = useCallback(async (productId: string) => {
    if (!uid) return;

    const prevItems = items;
    setItems(prev => prev.filter(item => item.productId !== productId));

    try {
      await removeFavorite(uid, productId);
    } catch {
      setItems(prevItems);
    }
  }, [uid, items]);

  useEffect(() => {
    mountedRef.current = true;
    currentUidRef.current = uid;
    fetchFirst();

    return () => {
      mountedRef.current = false;
      currentUidRef.current = undefined;
    };
  }, [uid]);

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    remove,
    loadMore,
    refresh: fetchFirst,
  };
}

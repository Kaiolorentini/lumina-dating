// ============================================
// useFavorites — HOOK
//
// Favoritos paginados do usuário.
// Verificação rápida por ID composto.
// Protegido: mountedRef + requestIdRef.
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import {
  getUserFavorites,
  addFavorite,
  removeFavorite,
  isFavorited,
} from '../services/marketplace/favoritesService';

interface UseFavoritesReturn {
  favoriteIds: string[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  toggleFavorite: (productId: string) => Promise<void>;
  checkIsFavorited: (productId: string) => Promise<boolean>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFavorites(
  uid: string | undefined,
  pageSize = 20,
): UseFavoritesReturn {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
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
      const result = await getUserFavorites(capturedUid, pageSize, null);

      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
      if (currentUidRef.current !== capturedUid) return;

      setFavoriteIds(result.favoriteProductIds);
      setHasMore(result.hasMore);
      lastDocRef.current = result.lastDoc;
    } catch (e: any) {
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
      console.error('[useFavorites] fetchFirst error:', e.code, e.message);
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
      const result = await getUserFavorites(uid, pageSize, lastDocRef.current);
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;

      setFavoriteIds(prev => [...prev, ...result.favoriteProductIds]);
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

  const toggleFavorite = useCallback(async (productId: string) => {
    if (!uid) return;
    const alreadyFavorited = favoriteIds.includes(productId);

    // Optimistic update
    setFavoriteIds(prev =>
      alreadyFavorited ? prev.filter(id => id !== productId) : [...prev, productId],
    );

    try {
      if (alreadyFavorited) {
        await removeFavorite(uid, productId);
      } else {
        await addFavorite(uid, productId);
      }
    } catch {
      // Reverte optimistic update em caso de erro
      setFavoriteIds(prev =>
        alreadyFavorited ? [...prev, productId] : prev.filter(id => id !== productId),
      );
    }
  }, [uid, favoriteIds]);

  const checkIsFavorited = useCallback(async (productId: string): Promise<boolean> => {
    if (!uid) return false;
    return isFavorited(uid, productId);
  }, [uid]);

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
    favoriteIds,
    loading,
    loadingMore,
    hasMore,
    error,
    toggleFavorite,
    checkIsFavorited,
    loadMore,
    refresh: fetchFirst,
  };
}
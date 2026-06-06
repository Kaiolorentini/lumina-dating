// ============================================
// useReviews — HOOK
//
// Avaliações paginadas de um produto.
// Review do usuário atual verificada separadamente.
// Protegido: mountedRef + requestIdRef.
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import { getProductReviews, getMyReview } from '../services/marketplace/reviewService';
import { ProductReview } from '../shared/types/marketplace';

interface UseReviewsReturn {
  reviews: ProductReview[];
  myReview: ProductReview | null;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useReviews(
  productId: string | undefined,
  userId: string | undefined,
  pageSize = 10,
): UseReviewsReturn {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [myReview, setMyReview] = useState<ProductReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);

  const fetchFirst = useCallback(async () => {
    if (!mountedRef.current || !productId) return;

    const thisRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    lastDocRef.current = null;

    try {
      const [result, userReview] = await Promise.all([
        getProductReviews(productId, pageSize, null),
        userId ? getMyReview(productId, userId) : Promise.resolve(null),
      ]);

      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;

      setReviews(result.reviews);
      setHasMore(result.hasMore);
      setMyReview(userReview);
      lastDocRef.current = result.lastDoc;
    } catch (e: any) {
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
      setError(e.message ?? 'Erro ao carregar avaliações');
    } finally {
      if (mountedRef.current && thisRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [productId, userId, pageSize]);

  const loadMore = useCallback(async () => {
    if (!mountedRef.current || loadingMore || !hasMore || !lastDocRef.current || !productId) return;

    const thisRequestId = ++requestIdRef.current;
    setLoadingMore(true);

    try {
      const result = await getProductReviews(productId, pageSize, lastDocRef.current);

      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;

      setReviews(prev => [...prev, ...result.reviews]);
      setHasMore(result.hasMore);
      lastDocRef.current = result.lastDoc;
    } catch (e: any) {
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
      setError(e.message ?? 'Erro ao carregar mais avaliações');
    } finally {
      if (mountedRef.current && thisRequestId === requestIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [productId, pageSize, loadingMore, hasMore]);

  useEffect(() => {
    mountedRef.current = true;
    fetchFirst();

    return () => {
      mountedRef.current = false;
    };
  }, [productId, userId]);

  return { reviews, myReview, loading, loadingMore, hasMore, error, loadMore, refresh: fetchFirst };
}
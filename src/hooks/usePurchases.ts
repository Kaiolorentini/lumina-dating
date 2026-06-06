// ============================================
// usePurchases — HOOK
//
// Purchases ativas do comprador.
// Protegido: mountedRef + currentUidRef + requestIdRef.
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import {
  getBuyerPurchases,
  hasActivePurchase,
  listenToBuyerPurchases,
} from '../services/marketplace/marketplacePurchaseService';
import { Purchase } from '../shared/types/marketplace';

interface UsePurchasesReturn {
  purchases: Purchase[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  checkAccess: (productId: string) => Promise<boolean>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePurchases(uid: string | undefined): UsePurchasesReturn {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const currentUidRef = useRef<string | undefined>(uid);
  const requestIdRef = useRef(0);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    currentUidRef.current = uid;

    if (!uid) {
      setPurchases([]);
      setLoading(false);
      return () => {
        mountedRef.current = false;
        currentUidRef.current = undefined;
      };
    }

    const capturedUid = uid;

    // Listener em tempo real para purchases
    const unsubscribe = listenToBuyerPurchases(capturedUid, updatedPurchases => {
      if (!mountedRef.current) return;
      if (currentUidRef.current !== capturedUid) return;
      setPurchases(updatedPurchases);
      setLoading(false);
    });

    return () => {
      mountedRef.current = false;
      currentUidRef.current = undefined;
      unsubscribe();
    };
  }, [uid]);

  const loadMore = useCallback(async () => {
    if (!mountedRef.current || loadingMore || !hasMore || !uid) return;

    const thisRequestId = ++requestIdRef.current;
    const capturedUid = uid;
    setLoadingMore(true);

    try {
      const result = await getBuyerPurchases(capturedUid, 20, lastDocRef.current);
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
      if (currentUidRef.current !== capturedUid) return;

      setPurchases(prev => [...prev, ...result.purchases]);
      setHasMore(result.hasMore);
      lastDocRef.current = result.lastDoc;
    } catch (e: any) {
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
      setError(e.message ?? 'Erro ao carregar mais compras');
    } finally {
      if (mountedRef.current && thisRequestId === requestIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [uid, loadingMore, hasMore]);

  const checkAccess = useCallback(async (productId: string): Promise<boolean> => {
    if (!uid) return false;
    return hasActivePurchase(uid, productId);
  }, [uid]);

  const refresh = useCallback(async () => {
    if (!uid || !mountedRef.current) return;

    const thisRequestId = ++requestIdRef.current;
    const capturedUid = uid;

    setLoading(true);
    setError(null);
    lastDocRef.current = null;

    try {
      const result = await getBuyerPurchases(capturedUid, 20, null);
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
      if (currentUidRef.current !== capturedUid) return;

      setPurchases(result.purchases);
      setHasMore(result.hasMore);
      lastDocRef.current = result.lastDoc;
    } catch (e: any) {
      if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
      setError(e.message ?? 'Erro ao recarregar compras');
    } finally {
      if (mountedRef.current && thisRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [uid]);

  return {
    purchases,
    loading,
    loadingMore,
    hasMore,
    error,
    checkAccess,
    loadMore,
    refresh,
  };
}
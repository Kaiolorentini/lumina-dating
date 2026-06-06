// ============================================
// useCreatorWallet — HOOK
//
// Wallet e transações do criador em tempo real.
// Protegido: mountedRef + currentUidRef.
//
// CORREÇÃO M2: requestIdRef separado para transações
// evita conflito entre listener de wallet e
// carregamento de transações quando uid muda.
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import {
  listenToCreatorWallet,
  getCreatorTransactions,
} from '../services/marketplace/creatorWalletService';
import {
  CreatorWallet,
  CreatorTransaction,
  CreatorTransactionType,
} from '../shared/types/marketplace';

interface UseCreatorWalletReturn {
  wallet: CreatorWallet | null;
  transactions: CreatorTransaction[];
  loading: boolean;
  loadingTransactions: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMoreTransactions: () => Promise<void>;
  refreshTransactions: (type?: CreatorTransactionType) => Promise<void>;
}

export function useCreatorWallet(uid: string | undefined): UseCreatorWalletReturn {
  const [wallet, setWallet] = useState<CreatorWallet | null>(null);
  const [transactions, setTransactions] = useState<CreatorTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const currentUidRef = useRef<string | undefined>(uid);

  // CORREÇÃO M2: requestIdRef SEPARADO para transações
  // Não compartilhado com o listener de wallet
  const txRequestIdRef = useRef(0);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);
  const currentTypeRef = useRef<CreatorTransactionType | undefined>(undefined);

  // ============================================
  // useEffect 1 — Listener de wallet em tempo real
  // Responsabilidade única: wallet
  // ============================================
  useEffect(() => {
    mountedRef.current = true;
    currentUidRef.current = uid;

    if (!uid) {
      setWallet(null);
      setLoading(false);
      return () => {
        mountedRef.current = false;
        currentUidRef.current = undefined;
      };
    }

    const capturedUid = uid;

    const unsubscribe = listenToCreatorWallet(capturedUid, updatedWallet => {
      if (!mountedRef.current) return;
      if (currentUidRef.current !== capturedUid) return;
      setWallet(updatedWallet);
      setLoading(false);
    });

    return () => {
      mountedRef.current = false;
      currentUidRef.current = undefined;
      unsubscribe();
    };
  }, [uid]);

  // ============================================
  // useEffect 2 — Carrega transações iniciais
  // Responsabilidade única: transações
  // Usa txRequestIdRef próprio — sem conflito com wallet
  // ============================================
  useEffect(() => {
    if (!uid) {
      setTransactions([]);
      setLoadingTransactions(false);
      return;
    }
    // refreshTransactions usa txRequestIdRef internamente
    refreshTransactions();
  }, [uid]);

  // ============================================
  // refreshTransactions — usa txRequestIdRef exclusivo
  // ============================================
  const refreshTransactions = useCallback(async (
    type?: CreatorTransactionType,
  ) => {
    if (!uid || !mountedRef.current) return;

    // txRequestIdRef independente — nunca conflita com wallet
    const thisTxRequestId = ++txRequestIdRef.current;
    const capturedUid = uid;
    currentTypeRef.current = type;
    lastDocRef.current = null;
    setLoadingTransactions(true);
    setError(null);

    try {
      const result = await getCreatorTransactions(capturedUid, 20, null, type);

      if (!mountedRef.current || thisTxRequestId !== txRequestIdRef.current) return;
      if (currentUidRef.current !== capturedUid) return;

      setTransactions(result.transactions);
      setHasMore(result.hasMore);
      lastDocRef.current = result.lastDoc;
    } catch (e: any) {
      if (!mountedRef.current || thisTxRequestId !== txRequestIdRef.current) return;
      setError(e.message ?? 'Erro ao carregar transações');
    } finally {
      if (mountedRef.current && thisTxRequestId === txRequestIdRef.current) {
        setLoadingTransactions(false);
      }
    }
  }, [uid]);

  // ============================================
  // loadMoreTransactions — usa txRequestIdRef exclusivo
  // ============================================
  const loadMoreTransactions = useCallback(async () => {
    if (!mountedRef.current || loadingMore || !hasMore || !uid) return;
    if (!lastDocRef.current) return;

    const thisTxRequestId = ++txRequestIdRef.current;
    const capturedUid = uid;
    setLoadingMore(true);

    try {
      const result = await getCreatorTransactions(
        capturedUid, 20, lastDocRef.current, currentTypeRef.current,
      );

      if (!mountedRef.current || thisTxRequestId !== txRequestIdRef.current) return;
      if (currentUidRef.current !== capturedUid) return;

      setTransactions(prev => [...prev, ...result.transactions]);
      setHasMore(result.hasMore);
      lastDocRef.current = result.lastDoc;
    } catch (e: any) {
      if (!mountedRef.current || thisTxRequestId !== txRequestIdRef.current) return;
      setError(e.message ?? 'Erro ao carregar mais transações');
    } finally {
      if (mountedRef.current && thisTxRequestId === txRequestIdRef.current) {
        setLoadingMore(false);
      }
    }
  }, [uid, loadingMore, hasMore]);

  return {
    wallet,
    transactions,
    loading,
    loadingTransactions,
    loadingMore,
    hasMore,
    error,
    loadMoreTransactions,
    refreshTransactions,
  };
}
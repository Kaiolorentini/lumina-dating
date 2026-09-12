// ============================================
// LUMINA — USE COINS PURCHASES v1.0
// src/hooks/useCoinsPurchases.ts
//
// Histórico de compras de Cristais Premium.
//
// POR QUE SEPARADO DE usePurchases:
// Compra de conteúdo vai para `purchases` (biblioteca que o
// usuário acessa). Compra de cristais vai para `coinsPurchases`
// (histórico financeiro que ele consulta). São coleções e
// finalidades diferentes.
//
// FIRESTORE RULES:
// coinsPurchases permite read se resource.data.uid == auth.uid.
// Para LIST, a query PRECISA filtrar por uid — sem o where o
// Firestore nega, porque a consulta poderia retornar documentos
// de terceiros.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, query, where, orderBy, limit, getDocs,
} from 'firebase/firestore';
import { db } from '../services/firebase';

export type CoinsPurchaseStatus = 'completed' | 'chargeback' | 'pending';

export interface CoinsPurchase {
  id:           string;
  saleId:       string;
  packageId:    string;
  packageLabel: string;
  coinsPremium: number;
  bonus:        number;
  totalCoins:   number;
  amount:       number;
  status:       CoinsPurchaseStatus;
  createdAt:    Date;
  /** Preenchidos apenas em estorno. */
  coinsReverted?: number;
  debtCreated?:   number;
}

const PAGE_LIMIT = 50;

export function useCoinsPurchases(uid: string | undefined) {
  const [purchases, setPurchases] = useState<CoinsPurchase[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }

    setError(null);

    try {
      const q = query(
        collection(db, 'coinsPurchases'),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(PAGE_LIMIT),
      );

      const snap = await getDocs(q);
      if (!mountedRef.current) return;

      setPurchases(snap.docs.map(d => {
        const data = d.data();
        return {
          id:            d.id,
          saleId:        data.saleId ?? '',
          packageId:     data.packageId ?? '',
          packageLabel:  data.packageLabel ?? 'Pacote',
          coinsPremium:  data.coinsPremium ?? 0,
          bonus:         data.bonus ?? 0,
          totalCoins:    data.totalCoins ?? 0,
          amount:        data.amount ?? 0,
          status:        (data.status ?? 'completed') as CoinsPurchaseStatus,
          createdAt:     data.createdAt?.toDate?.() ?? new Date(),
          coinsReverted: data.coinsReverted,
          debtCreated:   data.debtCreated,
        };
      }));
    } catch (err) {
      console.error('[useCoinsPurchases] load:', err);
      if (mountedRef.current) {
        setError('Não foi possível carregar seu histórico de cristais.');
      }
    } finally {
      // Sempre libera o loading.
      if (mountedRef.current) setLoading(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  return { purchases, loading, error, refresh: load };
}
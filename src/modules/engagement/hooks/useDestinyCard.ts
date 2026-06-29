// ============================================
// LUMINA — USE DESTINY CARD HOOK v5.1
// src/modules/engagement/hooks/useDestinyCard.ts
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';

const functions = getFunctions();

export interface DestinyProfile {
  uid:       string;
  name:      string;
  age:       number;
  photoURL:  string;
  city:      string;
  sintonia:  number;
  isPrimary: boolean;
}

export interface DestinyCardData {
  profiles:      DestinyProfile[];
  cartasHoje:    number;
  maxCartas:     number;
  isGalaxiaPlus: boolean;
  fromCache:     boolean;
}

interface State {
  data:     DestinyCardData | null;
  loading:  boolean;
  error:    string | null;
}

export function useDestinyCard(uid: string | undefined) {
  const [state, setState] = useState<State>({
    data:    null,
    loading: true,
    error:   null,
  });

  const loadCard = useCallback(async () => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const fn     = httpsCallable<void, DestinyCardData>(functions, 'getDestinyCard');
      const result = await fn();
      setState({ data: result.data, loading: false, error: null });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao carregar carta.';
      setState(prev => ({ ...prev, loading: false, error: msg }));
    }
  }, [uid]);

  useEffect(() => { loadCard(); }, [loadCard]);

  const markViewed = useCallback(async () => {
    if (!uid) return;
    try {
      const fn = httpsCallable(functions, 'markDestinyCardViewed');
      await fn();
    } catch (error) {
      console.error('[useDestinyCard] markViewed error:', error);
    }
  }, [uid]);

  return {
    data:      state.data,
    loading:   state.loading,
    error:     state.error,
    loadCard,
    markViewed,
  };
}
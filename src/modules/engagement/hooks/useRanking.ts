// ============================================
// LUMINA — USE RANKING HOOK v5.1
// src/modules/engagement/hooks/useRanking.ts
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';

const functions = getFunctions();

export interface RankingEntry {
  position:    number;
  uid:         string;
  displayName: string;
  photoURL:    string;
  socialXP:    number;
  weeklyXP:    number;
  league:      string;
}

export interface RankingData {
  weekId:           string;
  top50:            RankingEntry[];
  userPosition:     number | null;
  userXP:           number;
  xpToTop50:        number;
  xpToNextPosition: number;
  fromCache:        boolean;
}

interface State {
  data:    RankingData | null;
  loading: boolean;
  error:   string | null;
}

export function useRanking(uid: string | undefined) {
  const [state, setState] = useState<State>({
    data:    null,
    loading: true,
    error:   null,
  });

  const load = useCallback(async () => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const fn     = httpsCallable<void, RankingData>(functions, 'getRanking');
      const result = await fn();
      setState({ data: result.data, loading: false, error: null });
    } catch (error) {
      console.error('[useRanking] error:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar ranking.' }));
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  return {
    data:    state.data,
    loading: state.loading,
    error:   state.error,
    refresh: load,
  };
}
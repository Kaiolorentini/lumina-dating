// ============================================
// LUMINA — USE PRESTIGE HOOK v5.1
// src/modules/engagement/hooks/usePrestige.ts
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';

const functions = getFunctions();

export interface PrestigeStage {
  stage:       number;
  name:        string;
  icon:        string;
  pointsMin:   number;
  color:       string;
  auraAsset:   string;
  title:       string;
  description: string;
}

export interface LegadoEntry {
  marcoId:   string;
  label:     string;
  points:    number;
  timestamp: string;
}

export interface PrestigeData {
  prestigePoints:  number;
  prestigeStage:   number;
  prestigeName:    string;
  prestigeIcon:    string;
  prestigeTitle:   string;
  prestigeColor:   string;
  prestigeAura:    string;
  description:     string;
  nextStage:       PrestigeStage | null;
  progress:        number;
  pointsToNext:    number;
  marcosClaimed:   string[];
  legado:          LegadoEntry[];
  flags: {
    PRESTIGE_ENABLED: boolean;
    PRESTIGE_AURAS:   boolean;
    PRESTIGE_TITLES:  boolean;
  };
}

interface State {
  data:    PrestigeData | null;
  loading: boolean;
  error:   string | null;
}

export function usePrestige(uid: string | undefined) {
  const [state, setState] = useState<State>({
    data:    null,
    loading: true,
    error:   null,
  });

  const load = useCallback(async () => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const fn     = httpsCallable<void, PrestigeData>(functions, 'getPrestigeStatus');
      const result = await fn();
      setState({ data: result.data, loading: false, error: null });
    } catch (error) {
      console.error('[usePrestige] error:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar Prestígio.' }));
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
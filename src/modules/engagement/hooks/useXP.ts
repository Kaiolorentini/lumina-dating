// ============================================
// LUMINA — USE XP HOOK v5.1
// src/modules/engagement/hooks/useXP.ts
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';

const functions = getFunctions();

export interface XPStatus {
  totalXP:           number;
  treeXP:            number;
  xpToday:           number;
  dailyMax:          number;
  level:             number;
  tier:              string;
  nextLevelXP:       number;
  levelProgress:     number;
  treeStage:         number;
  treeName:          string;
  treeIcon:          string;
  treeProgress:      number;
  nextTreeStage:     { stage: number; name: string; icon: string; treeXPMin: number } | null;
  fertilizanteAtivo: boolean;
  fertilizanteExpiraEm: string | null;
}

export interface EarnXPResult {
  xpGained:     number;
  treeXPGain:   number;
  newTotalXP:   number;
  newLevel:     number;
  newTier:      string;
  leveledUp:    boolean;
  stageUp:      boolean;
  newStage:     number;
  newStageName: string;
}

interface State {
  status:  XPStatus | null;
  loading: boolean;
  error:   string | null;
}

export function useXP(uid: string | undefined) {
  const [state, setState] = useState<State>({
    status:  null,
    loading: true,
    error:   null,
  });

  const loadStatus = useCallback(async () => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const fn     = httpsCallable<void, XPStatus>(functions, 'getXPStatus');
      const result = await fn();
      setState({ status: result.data, loading: false, error: null });
    } catch (error) {
      console.error('[useXP] load error:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar XP.' }));
    }
  }, [uid]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Ganha XP — servidor decide tudo
  const earn = useCallback(async (params: {
    action:          string;
    targetUid?:      string;
    actionId:        string;
    eventMultiplier?: number;
  }): Promise<EarnXPResult | null> => {
    if (!uid) return null;
    try {
      const fn     = httpsCallable<typeof params, { success: boolean } & EarnXPResult>(
        functions, 'earnXP'
      );
      const result = await fn(params);

      if (result.data.xpGained > 0) {
        // Atualiza estado local
        setState(prev => ({
          ...prev,
          status: prev.status ? {
            ...prev.status,
            totalXP:       result.data.newTotalXP,
            level:         result.data.newLevel,
            tier:          result.data.newTier,
            xpToday:       (prev.status.xpToday ?? 0) + result.data.xpGained,
            treeStage:     result.data.newStage,
            treeName:      result.data.newStageName,
          } : null,
        }));
      }

      return result.data;
    } catch (error) {
      console.error('[useXP] earn error:', error);
      return null;
    }
  }, [uid]);

  return {
    status:     state.status,
    loading:    state.loading,
    error:      state.error,
    earn,
    refresh:    loadStatus,
  };
}
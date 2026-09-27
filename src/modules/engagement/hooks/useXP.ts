// ============================================
// LUMINA — USE XP HOOK v5.2
// src/modules/engagement/hooks/useXP.ts
//
// v5.2 — as tabelas da tela (estágios da Árvore e formas de
// ganhar XP) vêm da getXPStatus. A XPScreen guardava cópias que
// ficaram várias versões atrás do servidor.
//
// earn() REMOVIDO: nenhuma tela usava, e mandava actionId e
// eventMultiplier que o earnXP v5.4 ignora. XP é creditado nos
// eventos (Engine) ou pelo engagementService — nunca por aqui.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';

const functions = getFunctions();

export interface TreeStagePublic {
  stage:       number;
  name:        string;
  icon:        string;
  treeXPMin:   number;
  rewardLabel: string;
}

export interface XPActionPublic {
  action: string;
  icon:   string;
  label:  string;
  note:   string;
  xp:     number;
  treeXP: number;
}

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
  /** Opcionais: servidores anteriores à v5.4 não devolvem. */
  treeStages?:       TreeStagePublic[];
  xpActions?:        XPActionPublic[];
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

  return {
    status:  state.status,
    loading: state.loading,
    error:   state.error,
    refresh: loadStatus,
  };
}
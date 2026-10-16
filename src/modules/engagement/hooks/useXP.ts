// ============================================
// LUMINA — USE XP HOOK v5.2
// src/modules/engagement/hooks/useXP.ts
//
// v5.3 (13/10/2026, web D4) — UMA chamada compartilhada. No
// computador o menu lateral, a Home e o Perfil ficam montados juntos
// e cada um chamava getXPStatus: 3 chamadas da mesma função. Agora o
// resultado fica guardado por 60 s (por usuário) e chamadas ao mesmo
// tempo esperam a mesma resposta. refresh() sempre busca de novo e
// avisa as outras telas abertas. No app: menos chamadas, mesmo dado.
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

export interface LevelRewardPublic {
  level:           number;
  fragments:       number;
  crystalsPremium: number;
  xpRequired:      number;
  received:        boolean;
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
  levelRewards?:     LevelRewardPublic[];
  maxLevel?:         number;
}

/** Tempo em que o resultado vale sem nova chamada. */
const CACHE_MS = 60_000;

interface CacheEntry { uid: string; at: number; data: XPStatus }
let cache: CacheEntry | null = null;
let inflight: { uid: string; promise: Promise<XPStatus> } | null = null;
const listeners = new Set<(uid: string, data: XPStatus) => void>();

function fetchXP(uid: string, force: boolean): Promise<XPStatus> {
  if (!force && cache && cache.uid === uid && Date.now() - cache.at < CACHE_MS) {
    return Promise.resolve(cache.data);
  }
  if (inflight && inflight.uid === uid) return inflight.promise;

  const fn = httpsCallable<void, XPStatus>(functions, 'getXPStatus');
  const promise = fn()
    .then(result => {
      cache = { uid, at: Date.now(), data: result.data };
      listeners.forEach(listener => listener(uid, result.data));
      return result.data;
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { uid, promise };
  return promise;
}

interface State {
  status:  XPStatus | null;
  loading: boolean;
  error:   string | null;
}

export function useXP(uid: string | undefined) {
  const cached = uid && cache?.uid === uid ? cache.data : null;
  const [state, setState] = useState<State>({
    status:  cached,
    loading: cached === null,
    error:   null,
  });

  const load = useCallback(async (force: boolean) => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: prev.status === null || force, error: null }));
    try {
      const data = await fetchXP(uid, force);
      setState({ status: data, loading: false, error: null });
    } catch (error) {
      console.error('[useXP] load error:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar XP.' }));
    }
  }, [uid]);

  useEffect(() => { load(false); }, [load]);

  // Outra tela buscou de novo (refresh): esta mostra o mesmo número.
  useEffect(() => {
    if (!uid) return;
    const listener = (who: string, data: XPStatus) => {
      if (who === uid) setState({ status: data, loading: false, error: null });
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [uid]);

  const refresh = useCallback(() => load(true), [load]);

  return {
    status:  state.status,
    loading: state.loading,
    error:   state.error,
    refresh,
  };
}

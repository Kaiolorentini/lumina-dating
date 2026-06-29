// ============================================
// LUMINA — USE MISSIONS HOOK v5.2
// src/modules/engagement/hooks/useMissions.ts
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';

const functions = getFunctions();

export interface CommonMission {
  missionId:  string;
  type:       string;
  label:      string;
  icon:       string;
  fragments:  number;
  target:     number;
  unit:       string;
  progress:   number;
  completed:  boolean;
  claimed:    boolean;
}

export interface SpecialMission {
  missionId: string;
  type:      string;
  label:     string;
  icon:      string;
  crystals:  number;
  target:    number;
  progress:  number;
  completed: boolean;
  claimed:   boolean;
}

export interface MissionsData {
  missions:                CommonMission[];
  special:                 SpecialMission;
  fragments:               number;
  coinsGratuitos:          number;
  fragmentsEarnedToday:    number;
  crystalsEarnedToday:     number;
  allCompleteBonusClaimed: boolean;
}

interface State {
  data:    MissionsData | null;
  loading: boolean;
  error:   string | null;
}

export function useMissions(uid: string | undefined) {
  const [state,       setState]       = useState<State>({ data: null, loading: true, error: null });
  const [progressing, setProgressing] = useState<string | null>(null);

  const loadMissions = useCallback(async () => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const fn     = httpsCallable<void, MissionsData>(functions, 'getDailyMissions');
      const result = await fn();
      setState({ data: result.data, loading: false, error: null });
    } catch (error) {
      console.error('[useMissions] load error:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar missões.' }));
    }
  }, [uid]);

  useEffect(() => { loadMissions(); }, [loadMissions]);

  const progressMission = useCallback(async (params: {
    missionIdParam: string;
    targetUid?:     string;
    messageLength?: number;
  }): Promise<{
    completed:  boolean;
    fragments:  number;
    crystals:   number;
    duplicate?: boolean;
  } | null> => {
    if (!uid || progressing) return null;
    setProgressing(params.missionIdParam);
    try {
      const fn = httpsCallable<typeof params, {
        success:          boolean;
        alreadyCompleted: boolean;
        duplicate?:       boolean;
        completed:        boolean;
        fragments:        number;
        crystals:         number;
        progress:         number;
      }>(functions, 'progressMission');

      const result = await fn(params);

      if (!result.data.alreadyCompleted && !result.data.duplicate) {
        setState(prev => {
          if (!prev.data) return prev;
          const updatedMissions = prev.data.missions.map(m =>
            m.missionId === params.missionIdParam
              ? { ...m, progress: result.data.progress, completed: result.data.completed, claimed: result.data.completed }
              : m
          );
          const updatedSpecial = prev.data.special?.missionId === params.missionIdParam
            ? { ...prev.data.special, progress: result.data.progress, completed: result.data.completed, claimed: result.data.completed }
            : prev.data.special;
          return {
            ...prev,
            data: {
              ...prev.data,
              missions:             updatedMissions,
              special:              updatedSpecial,
              fragments:            prev.data.fragments            + result.data.fragments,
              coinsGratuitos:       prev.data.coinsGratuitos       + result.data.crystals,
              fragmentsEarnedToday: prev.data.fragmentsEarnedToday + result.data.fragments,
              crystalsEarnedToday:  prev.data.crystalsEarnedToday  + result.data.crystals,
            },
          };
        });
      }

      return {
        completed:  result.data.completed,
        fragments:  result.data.fragments,
        crystals:   result.data.crystals,
        duplicate:  result.data.duplicate,
      };
    } catch (error: unknown) {
      console.error('[useMissions] progress error:', error);
      return null;
    } finally {
      setProgressing(null);
    }
  }, [uid, progressing]);

  return {
    data:            state.data,
    loading:         state.loading,
    error:           state.error,
    progressing,
    progressMission,
    refresh:         loadMissions,
  };
}
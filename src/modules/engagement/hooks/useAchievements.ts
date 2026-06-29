// ============================================
// LUMINA — USE ACHIEVEMENTS HOOK v5.1
// src/modules/engagement/hooks/useAchievements.ts
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';

const functions = getFunctions();

export type AchievementRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';
export type CollectionTier    = 'BRONZE' | 'SILVER' | 'GOLD';

export interface Achievement {
  id:          string;
  title:       string;
  description: string;
  category:    string;
  rarity:      AchievementRarity;
  icon:        string;
  hidden:      boolean;
  target:      number;
  progress:    number;
  unlocked:    boolean;
  unlockedAt:  string | null;
  reward:      { xp: number; fragments: number; badge: string | null; title: string | null };
}

export interface Collection {
  id:          string;
  title:       string;
  description: string;
  category:    string;
  tier:        CollectionTier;
  icon:        string;
  completed:   boolean;
  achProgress: number;
  achTotal:    number;
  reward:      { fragments: number; badge: string | null; title: string | null };
}

export interface AchievementsData {
  achievements:   Achievement[];
  collections:    Collection[];
  totalUnlocked:  number;
  totalAvailable: number;
}

interface State {
  data:    AchievementsData | null;
  loading: boolean;
  error:   string | null;
}

export function useAchievements(uid: string | undefined) {
  const [state, setState] = useState<State>({
    data:    null,
    loading: true,
    error:   null,
  });

  const load = useCallback(async () => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const fn     = httpsCallable<void, AchievementsData>(functions, 'getAchievementsStatus');
      const result = await fn();
      setState({ data: result.data, loading: false, error: null });
    } catch (error) {
      console.error('[useAchievements] error:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar conquistas.' }));
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  // Verifica conquistas após uma ação
  const check = useCallback(async (params: {
    action:       string;
    currentValue: number;
    meta?:        Record<string, unknown>;
  }): Promise<string[]> => {
    if (!uid) return [];
    try {
      const fn     = httpsCallable<typeof params, { unlocked: string[] }>(
        functions, 'checkAchievements'
      );
      const result = await fn(params);
      if (result.data.unlocked.length > 0) await load(); // recarrega
      return result.data.unlocked;
    } catch (error) {
      console.error('[useAchievements] check error:', error);
      return [];
    }
  }, [uid, load]);

  return {
    data:    state.data,
    loading: state.loading,
    error:   state.error,
    check,
    refresh: load,
  };
}
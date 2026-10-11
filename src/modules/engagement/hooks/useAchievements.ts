// ============================================
// LUMINA — USE ACHIEVEMENTS HOOK v5.2
// src/modules/engagement/hooks/useAchievements.ts
//
// v5.2 (10/10/2026) — coleções coletáveis: `claimed`/`claimable`
// em cada coleção e claimCollection(), que chama a callable
// claimCollectionReward. Os fragmentos vão para o Cofre; o valor
// pago vem do servidor. Depois da coleta, a coleção é marcada
// como coletada aqui mesmo — sem recarregar a tela inteira.
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
  /** Fragmentos já coletados (foram para o Cofre). */
  claimed:     boolean;
  /** Completa, com fragmentos e ainda não coletada: mostra "Coletar". */
  claimable:   boolean;
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

export interface ClaimCollectionResult {
  success:        true;
  alreadyClaimed: boolean;
  collectionId:   string;
  fragments:      number;
  vaultFragments: number;
}

interface State {
  data:    AchievementsData | null;
  loading: boolean;
  error:   string | null;
}

/** Mensagem amigável para os erros da callable de coleta. */
function claimErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
  if (code.endsWith('failed-precondition')) {
    return 'Esta coleção ainda não pode ser coletada. Atualize a tela e tente de novo.';
  }
  if (code.endsWith('unauthenticated')) return 'Sua sessão expirou. Entre de novo para coletar.';
  if (code.endsWith('unavailable') || code.endsWith('deadline-exceeded')) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
  }
  return 'Não foi possível coletar agora. Tente de novo em instantes.';
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

  // check() REMOVIDO: chamava a callable checkAchievements, que
  // aceitava ação e valor do app e foi apagada. Nenhuma tela o
  // usava. Conquistas entram só pelo servidor.

  /**
   * Coleta os fragmentos de uma coleção completa (vão para o Cofre).
   * Lança Error com mensagem pronta para a tela quando falha.
   */
  const claimCollection = useCallback(async (collectionId: string): Promise<ClaimCollectionResult> => {
    try {
      const fn = httpsCallable<{ collectionId: string }, ClaimCollectionResult>(
        functions, 'claimCollectionReward',
      );
      const result = await fn({ collectionId });

      setState(prev => {
        if (!prev.data) return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            collections: prev.data.collections.map(col =>
              col.id === collectionId
                ? { ...col, completed: true, claimed: true, claimable: false }
                : col,
            ),
          },
        };
      });

      return result.data;
    } catch (error) {
      console.error('[useAchievements] claimCollection error:', error);
      throw new Error(claimErrorMessage(error));
    }
  }, []);

  return {
    data:    state.data,
    loading: state.loading,
    error:   state.error,
    refresh: load,
    claimCollection,
  };
}

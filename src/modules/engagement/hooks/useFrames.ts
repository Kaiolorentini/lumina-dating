// ============================================
// LUMINA — USE FRAMES HOOK v1.0
// src/modules/engagement/hooks/useFrames.ts
//
// FASE 5 — molduras de perfil.
// Leitura e equipamento passam por Cloud Function; o cliente
// nunca escreve em progression (rule bloqueia).
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';

const functions = getFunctions();

export interface OwnedFrame {
  id:          string;
  title:       string;
  description: string;
  rarity:      'RARE' | 'EPIC' | 'LEGENDARY';
  borderColor: string;
  glowColor:   string;
  borderWidth: number;
  animated:    boolean;
  permanent:   boolean;
  expiresAt:   string | null;
  expired:     boolean;
}

export interface FramesStatus {
  owned:         OwnedFrame[];
  expired:       OwnedFrame[];
  equippedFrame: string | null;
}

interface State {
  data:    FramesStatus | null;
  loading: boolean;
  error:   string | null;
}

// Dias restantes do aluguel — null quando permanente.
export function daysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 3600000)));
}

export function useFrames(uid: string | undefined) {
  const [state,     setState]     = useState<State>({ data: null, loading: true, error: null });
  const [equipping, setEquipping] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const fn     = httpsCallable<void, FramesStatus>(functions, 'getFramesStatus');
      const result = await fn();
      setState({ data: result.data, loading: false, error: null });
    } catch (error) {
      console.error('[useFrames] load error:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar molduras.' }));
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const equip = useCallback(async (frameId: string | null): Promise<boolean> => {
    if (!uid || equipping) return false;
    setEquipping(frameId ?? 'none');
    try {
      const fn = httpsCallable<{ frameId: string | null }, { success: boolean; equippedFrame: string | null }>(
        functions, 'equipFrame'
      );
      const result = await fn({ frameId });

      setState(prev => prev.data
        ? { ...prev, data: { ...prev.data, equippedFrame: result.data.equippedFrame } }
        : prev
      );
      return true;
    } catch (error: unknown) {
      const e = error as { message?: string };
      console.error('[useFrames] equip error:', e?.message);
      return false;
    } finally {
      setEquipping(null);
    }
  }, [uid, equipping]);

  return {
    data:    state.data,
    loading: state.loading,
    error:   state.error,
    equipping,
    equip,
    refresh: load,
  };
}

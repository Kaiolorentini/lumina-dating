// ============================================
// LUMINA — USE BADGES HOOK v1.0
// src/modules/engagement/hooks/useBadges.ts
//
// FASE 6 — badges de perfil.
// Espelha useFrames. Leitura e equipamento passam por Cloud
// Function; o cliente nunca escreve em progression (rule bloqueia).
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';
import { BadgeShape, BadgeMotion }          from '../../../components/profile/Badge';

const functions = getFunctions();

export interface OwnedBadge {
  id:          string;
  title:       string;
  description: string;
  rarity:      'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';
  source:      'SHOP' | 'ACHIEVEMENT';
  // Só os da loja trazem aparência; os de conquista vêm nulos e
  // são desenhados a partir da raridade.
  shape:       BadgeShape  | null;
  coreColor:   string      | null;
  accentColor: string      | null;
  glowColor:   string      | null;
  motion:      BadgeMotion | null;
  permanent:   boolean;
  expiresAt:   string | null;
  expired:     boolean;
}

export interface BadgesStatus {
  owned:         OwnedBadge[];
  expired:       OwnedBadge[];
  equippedBadge: string | null;
}

interface State {
  data:    BadgesStatus | null;
  loading: boolean;
  error:   string | null;
}

// Genéricos extraídos para evitar `httpsCallable<` em fim de
// linha, que é corrompido de forma recorrente ao colar.
type EquipReq = { badgeId: string | null };
type EquipRes = { success: boolean; equippedBadge: string | null };
type BuyReq   = { badgeId: string };
type BuyRes   = { success: boolean; badgeId: string; spent: number; newFragments: number };

// Aparência de fallback para badges de conquista, que não têm
// direção visual própria no catálogo — derivada da raridade.
const ACHIEVEMENT_LOOK: Record<string, {
  shape: BadgeShape; coreColor: string; accentColor: string;
  glowColor: string; motion: BadgeMotion;
}> = {
  COMMON:    { shape: 'spark',     coreColor: '#8FA3C8', accentColor: '#D6E0F5', glowColor: 'rgba(143,163,200,0.4)', motion: 'none' },
  RARE:      { shape: 'orbit',     coreColor: '#56CCF2', accentColor: '#CFF0FF', glowColor: 'rgba(86,204,242,0.5)',  motion: 'breathe' },
  EPIC:      { shape: 'pulsar',    coreColor: '#B57BEE', accentColor: '#E8D4FF', glowColor: 'rgba(181,123,238,0.6)', motion: 'breathe' },
  LEGENDARY: { shape: 'solar_crown', coreColor: '#2A2018', accentColor: '#FFD700', glowColor: 'rgba(255,215,0,0.7)', motion: 'rotate' },
  MYTHIC:    { shape: 'genesis',   coreColor: '#FFFFFF', accentColor: '#FFD700', glowColor: 'rgba(255,215,0,0.85)',  motion: 'orbit_particles' },
};

export function badgeAppearance(badge: OwnedBadge) {
  if (badge.shape && badge.coreColor && badge.accentColor && badge.glowColor && badge.motion) {
    return {
      shape:       badge.shape,
      coreColor:   badge.coreColor,
      accentColor: badge.accentColor,
      glowColor:   badge.glowColor,
      motion:      badge.motion,
    };
  }
  return ACHIEVEMENT_LOOK[badge.rarity] ?? ACHIEVEMENT_LOOK.COMMON;
}

export function daysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 3600000)));
}

export function useBadges(uid: string | undefined) {
  const [state,     setState]     = useState<State>({ data: null, loading: true, error: null });
  const [equipping, setEquipping] = useState<string | null>(null);
  const [buying,    setBuying]    = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const fn     = httpsCallable<void, BadgesStatus>(functions, 'getBadgesStatus');
      const result = await fn();
      setState({ data: result.data, loading: false, error: null });
    } catch (error) {
      console.error('[useBadges] load error:', error);
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar badges.' }));
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const equip = useCallback(async (badgeId: string | null): Promise<boolean> => {
    if (!uid || equipping) return false;
    setEquipping(badgeId ?? 'none');
    try {
      const equipFn = httpsCallable<EquipReq, EquipRes>(functions, 'equipBadge');
      const result  = await equipFn({ badgeId });

      setState(prev => prev.data
        ? { ...prev, data: { ...prev.data, equippedBadge: result.data.equippedBadge } }
        : prev
      );
      return true;
    } catch (error: unknown) {
      console.error('[useBadges] equip error:', (error as { message?: string })?.message);
      return false;
    } finally {
      setEquipping(null);
    }
  }, [uid, equipping]);

  // Compra com fragmentos. Badges de cristais passam pelo
  // spendCoins, como as molduras.
  const buyWithFragments = useCallback(async (badgeId: string): Promise<{
    ok: boolean; error?: string;
  }> => {
    if (!uid || buying) return { ok: false };
    setBuying(badgeId);
    try {
      const buyFn = httpsCallable<BuyReq, BuyRes>(functions, 'buyBadgeWithFragments');
      await buyFn({ badgeId });
      await load();
      return { ok: true };
    } catch (error: unknown) {
      const e = error as { message?: string };
      console.error('[useBadges] buy error:', e?.message);
      return { ok: false, error: e?.message };
    } finally {
      setBuying(null);
    }
  }, [uid, buying, load]);

  return {
    data:    state.data,
    loading: state.loading,
    error:   state.error,
    equipping,
    buying,
    equip,
    buyWithFragments,
    refresh: load,
  };
}
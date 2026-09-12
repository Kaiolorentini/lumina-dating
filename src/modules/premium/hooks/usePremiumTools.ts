// ============================================
// LUMINA — USE PREMIUM TOOLS HOOK v5.2
// src/modules/premium/hooks/usePremiumTools.ts
//
// Hook unificado para todas as ferramentas Premium.
// Estado calculado server-side — cliente só exibe.
//
// v5.2:
// - Destaque Regional adicionado.
// - As ativações agora devolvem ActivationResult com a MENSAGEM
//   do servidor, não só boolean. Motivo: o guard de região do
//   Destaque ("Sua região ainda não tem gente suficiente") e a
//   trava de exclusividade ("Você já tem Turbo ativo") são
//   informação útil que virava "Tente novamente" genérico —
//   o usuário tentava de novo, falhava de novo, e a proteção
//   que evitaria o estorno virava frustração.
// - getFunctions() lazy: chamar no escopo do módulo executa no
//   import, sem garantia de que initializeApp() já rodou.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable }      from 'firebase/functions';
import { PremiumFeatureStatus }              from '../../../navigation/types';

// Lazy: resolvido na primeira chamada, não no import.
function fns() {
  return getFunctions();
}

// ============================================
// TIPOS DE STATUS
// ============================================

export interface FertilizerStatus {
  status:         PremiumFeatureStatus;
  isActive:       boolean;
  expiresAt:      string | null;
  remainingMs:    number;
  remainingHours: number;
  xpMultiplier:   number;
  cost:           number;
  coinsPremium:   number;
  enabled:        boolean;
}

export interface TurboStatus {
  status:       PremiumFeatureStatus;
  isActive:     boolean;
  expiresAt:    string | null;
  remainingMs:  number;
  remainingMin: number;
  boostScore:   number;
  cooldownMs:   number;
  inCooldown:   boolean;
  cost:         number;
  coinsPremium: number;
  enabled:      boolean;
}

export interface ImpulsoStatus {
  status:         PremiumFeatureStatus;
  remainingMs:    number;
  cost:           number;
  boostScore:     number;
  coinsGratuitos: number;
  coinsPremium:   number;
  enabled:        boolean;
}

export interface DestaqueStatus {
  status:           PremiumFeatureStatus;
  remainingMs:      number;
  cost:             number;
  boostScore:       number;
  durationHours:    number;
  regiaoId:         string | null;
  city:             string | null;
  state:            string | null;
  usersInRegion:    number | null;
  minUsersInRegion: number;
  coinsGratuitos:   number;
  coinsPremium:     number;
  enabled:          boolean;
}

/**
 * Resultado de uma ativação.
 * `error` carrega a mensagem exata da HttpsError do servidor —
 * é ela que a tela deve exibir, não um texto genérico.
 */
export interface ActivationResult {
  ok:     boolean;
  error?: string;
}

interface State {
  fertilizer: FertilizerStatus | null;
  turbo:      TurboStatus | null;
  impulso:    ImpulsoStatus | null;
  destaque:   DestaqueStatus | null;
  loading:    boolean;
  activating: string | null;
  error:      string | null;
}

// ============================================
// EXTRAÇÃO DA MENSAGEM DO SERVIDOR
//
// O SDK do Firebase preserva a mensagem da HttpsError lançada
// na Cloud Function. É ela que explica POR QUE falhou.
// ============================================
function extractMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message: unknown }).message).trim();
    if (msg.length > 0) return msg;
  }
  return fallback;
}

export function usePremiumTools(uid: string | undefined) {
  const [state, setState] = useState<State>({
    fertilizer: null,
    turbo:      null,
    impulso:    null,
    destaque:   null,
    loading:    true,
    activating: null,
    error:      null,
  });

  const load = useCallback(async () => {
    if (!uid) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const f = fns();
      const [fertResult, turboResult, impulsoResult, destaqueResult] = await Promise.all([
        httpsCallable<void, FertilizerStatus>(f, 'getFertilizerStatus')(),
        httpsCallable<void, TurboStatus>(f, 'getTurboStatus')(),
        httpsCallable<void, ImpulsoStatus>(f, 'getImpulsoStatus')(),
        httpsCallable<void, DestaqueStatus>(f, 'getDestaqueRegionalStatus')(),
      ]);
      setState(prev => ({
        ...prev,
        fertilizer: fertResult.data,
        turbo:      turboResult.data,
        impulso:    impulsoResult.data,
        destaque:   destaqueResult.data,
        loading:    false,
      }));
    } catch (error) {
      console.error('[usePremiumTools] load error:', error);
      // Sempre libera o loading — silent failure com spinner
      // eterno é o padrão de falha mais recorrente do projeto.
      setState(prev => ({ ...prev, loading: false, error: 'Erro ao carregar ferramentas.' }));
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  // ============================================
  // ATIVAÇÃO GENÉRICA
  // Mesmo contrato para as quatro ferramentas.
  // ============================================
  const activate = useCallback(
    async (
      featureKey: string,
      callableName: string,
      fallbackMessage: string,
    ): Promise<ActivationResult> => {
      if (!uid) return { ok: false, error: 'Você precisa estar autenticado.' };
      if (state.activating) return { ok: false };

      setState(prev => ({ ...prev, activating: featureKey, error: null }));

      try {
        const fn = httpsCallable<void, { success: boolean }>(fns(), callableName);
        const result = await fn();

        if (result.data?.success) {
          await load();
          return { ok: true };
        }
        return { ok: false, error: fallbackMessage };
      } catch (error: unknown) {
        const msg = extractMessage(error, fallbackMessage);
        setState(prev => ({ ...prev, error: msg }));

        // REGRA 11: registra tentativa para o Offer Engine
        try {
          await httpsCallable(fns(), 'registerPremiumAttempt')({ feature: featureKey });
        } catch { /* silencioso — não pode mascarar o erro real */ }

        return { ok: false, error: msg };
      } finally {
        setState(prev => ({ ...prev, activating: null }));
      }
    },
    [uid, state.activating, load],
  );

  const activateFertilizer = useCallback(
    () => activate('FERTILIZER', 'activateFertilizer', 'Não foi possível ativar o Fertilizante.'),
    [activate],
  );

  const activateTurbo = useCallback(
    () => activate('TURBO', 'activateTurbo', 'Não foi possível ativar o Turbo.'),
    [activate],
  );

  const activateImpulso = useCallback(
    () => activate('IMPULSO', 'activateImpulso', 'Não foi possível ativar o Impulso.'),
    [activate],
  );

  const activateDestaqueRegional = useCallback(
    () => activate('DESTAQUE', 'activateDestaqueRegional', 'Não foi possível ativar o Destaque Regional.'),
    [activate],
  );

  return {
    fertilizer: state.fertilizer,
    turbo:      state.turbo,
    impulso:    state.impulso,
    destaque:   state.destaque,
    loading:    state.loading,
    activating: state.activating,
    error:      state.error,
    activateFertilizer,
    activateTurbo,
    activateImpulso,
    activateDestaqueRegional,
    refresh: load,
  };
}
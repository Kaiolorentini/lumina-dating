// ============================================
// LUMINA — USE VISITORS v1.0
// src/modules/premium/hooks/useVisitors.ts
//
// Conecta o backend de Ver Visitantes (já pronto em
// functions/src/premium/visitorsService.ts) ao app.
//
// MODELO DO PRODUTO:
// O NÚMERO de visitas é grátis — é a isca.
// A IDENTIDADE de quem visitou custa REVEAL_VISITORS (50).
// Acesso liberado por 24h. O backend nunca devolve a lista
// sem acesso ativo (verificação server-side).
//
// PERFORMANCE:
// - Um único callable traz status + contadores + lista.
// - Contagem regressiva local, sem polling: o servidor devolve
//   remainingMs e o cliente apenas decrementa. Zero chamadas
//   extras enquanto a tela fica aberta.
// - O tick só roda quando há acesso ativo E a tela está visível.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

export interface VisitorProfile {
  uid:        string;
  name:       string;
  age:        number | null;
  city:       string | null;
  photoURL:   string | null;
  visitedAt:  string;
  visitCount: number;
}

export interface VisitorsStatus {
  status:         'LOCKED' | 'READY' | 'ACTIVE';
  isActive:       boolean;
  expiresAt:      string | null;
  remainingMs:    number;
  cost:           number;
  coinsGratuitos: number;
  coinsPremium:   number;
  totalVisits:    number;
  todayVisits:    number;
  visitors:       VisitorProfile[];
  enabled:        boolean;
}

export interface RevealResult {
  ok:     boolean;
  error?: string;
}

// Lazy: getFunctions() no escopo do módulo executa no import,
// sem garantia de que initializeApp() já rodou.
function fns() {
  return getFunctions();
}

function extractMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message: unknown }).message).trim();
    if (msg.length > 0) return msg;
  }
  return fallback;
}

export function useVisitors(uid: string | undefined, enabled: boolean = true) {
  const [data,       setData]       = useState<VisitorsStatus | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [revealing,  setRevealing]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [remaining,  setRemaining]  = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!uid || !enabled) {
      setLoading(false);
      return;
    }

    setError(null);

    try {
      const fn = httpsCallable<void, VisitorsStatus>(fns(), 'getVisitorsStatus');
      const result = await fn();

      if (!mountedRef.current) return;

      setData(result.data);
      setRemaining(result.data.remainingMs ?? 0);
    } catch (err) {
      console.error('[useVisitors] getVisitorsStatus:', err);
      if (mountedRef.current) {
        // Erro precisa chegar à tela — silent failure com loading
        // eterno é o padrão de falha mais recorrente do projeto.
        setError('Não foi possível carregar suas visitas.');
      }
    } finally {
      // Sempre libera.
      if (mountedRef.current) setLoading(false);
    }
  }, [uid, enabled]);

  useEffect(() => { load(); }, [load]);

  // Contagem regressiva local — 1 tick por segundo, só enquanto
  // há acesso ativo. Sem polling ao servidor.
  useEffect(() => {
    if (!data?.isActive || remaining <= 0) return;

    const timer = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1000;
        if (next <= 0) {
          // Expirou: recarrega para o backend confirmar o novo estado.
          load();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [data?.isActive, remaining > 0, load]);

  const reveal = useCallback(async (): Promise<RevealResult> => {
    if (!uid)      return { ok: false, error: 'Você precisa estar autenticado.' };
    if (revealing) return { ok: false };

    setRevealing(true);
    setError(null);

    try {
      const fn = httpsCallable<void, { success: boolean }>(fns(), 'revealVisitors');
      const result = await fn();

      if (result.data?.success) {
        await load();
        return { ok: true };
      }
      return { ok: false, error: 'Não foi possível revelar os visitantes.' };
    } catch (err) {
      // Mensagem do servidor: saldo insuficiente, acesso já ativo,
      // feature desligada. Cada uma orienta uma ação diferente.
      const msg = extractMessage(err, 'Não foi possível revelar os visitantes.');
      if (mountedRef.current) setError(msg);
      return { ok: false, error: msg };
    } finally {
      if (mountedRef.current) setRevealing(false);
    }
  }, [uid, revealing, load]);

  const canAfford = data
    ? (data.coinsGratuitos + data.coinsPremium) >= data.cost
    : false;

  return {
    data,
    loading,
    revealing,
    error,
    remainingMs: remaining,
    canAfford,
    reveal,
    refresh: load,
  };
}
// ============================================
// LUMINA — CLAIMS DE ACESSO NO TOKEN
// src/hooks/useAccessClaims.ts
//
// As Rules exigem a claim `av` (conta verificada) no token de Auth.
// Antes de abrir o app principal, garante que o token TEM a claim:
//   1. token salvo (local, funciona offline);
//   2. token renovado;
//   3. syncAccessClaims (o servidor deriva a claim do users/{uid}) e
//      renovação — até 3 vezes.
//
// Cobre: conta aprovada antes das claims existirem, a corrida entre o
// onSnapshot da aprovação e a gravação da claim, e falha ao gravá-la.
//
// Falha FECHADA: sem a claim, tela de erro com "Tentar novamente" —
// nunca o app principal com leituras negadas pelas Rules.
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../services/firebase';
import app from '../core/firebase';

const SYNC_ATTEMPTS  = 3;
const RETRY_DELAY_MS = 1500;

interface SyncResult {
  av:      boolean;
  ban:     boolean;
  changed: boolean;
}

type ClaimsState = 'checking' | 'ready' | 'error';

async function tokenHasAccess(forceRefresh: boolean): Promise<boolean> {
  const current = auth.currentUser;
  if (!current) return false;
  const result = await current.getIdTokenResult(forceRefresh);
  return result.claims.av === true && result.claims.ban !== true;
}

async function ensureAccessClaim(): Promise<boolean> {
  if (await tokenHasAccess(false)) return true;
  if (await tokenHasAccess(true)) return true;

  const sync = httpsCallable<void, SyncResult>(getFunctions(app, 'us-central1'), 'syncAccessClaims');

  for (let attempt = 1; attempt <= SYNC_ATTEMPTS; attempt++) {
    try {
      await sync();
    } catch (error) {
      console.warn(`[useAccessClaims] sync falhou (tentativa ${attempt}):`, error);
    }
    if (await tokenHasAccess(true)) return true;
    if (attempt < SYNC_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  return false;
}

interface UseAccessClaimsReturn {
  /** Token com a claim de acesso — pode abrir o app principal. */
  ready:  boolean;
  /** Não foi possível obter a claim depois das tentativas. */
  error:  boolean;
  retry:  () => void;
}

/**
 * @param uid    usuário logado
 * @param needed true quando a pessoa chegou ao app principal
 *               (conta aprovada ou superadmin)
 */
export function useAccessClaims(uid: string | undefined, needed: boolean): UseAccessClaimsReturn {
  const [state, setState]     = useState<ClaimsState>('checking');
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt(prev => prev + 1), []);

  useEffect(() => {
    if (!uid || !needed) {
      setState('checking');
      return;
    }

    let alive = true;
    setState('checking');

    ensureAccessClaim()
      .then(ok => { if (alive) setState(ok ? 'ready' : 'error'); })
      .catch(error => {
        console.warn('[useAccessClaims] falhou:', error);
        if (alive) setState('error');
      });

    return () => { alive = false; };
  }, [uid, needed, attempt]);

  return {
    ready: needed && state === 'ready',
    error: state === 'error',
    retry,
  };
}
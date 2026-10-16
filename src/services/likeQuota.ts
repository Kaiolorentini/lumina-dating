// ============================================
// LUMINA — CURTIDAS DE HOJE (x/150)
// src/services/likeQuota.ts
//
// Quantas curtidas NOVAS a pessoa já usou hoje e o limite diário,
// para mostrar "Curtidas hoje 12/150" no computador.
//
// O servidor é a verdade (onCreateMatch conta e barra). Aqui só se
// guarda o último número conhecido:
//   • uma chamada a getLikeQuota por usuário ao abrir o site;
//   • depois, cada curtida devolve o número novo (useLike chama
//     setLikeQuota) — zero chamada a mais;
//   • limite atingido (resource-exhausted) marca a cota cheia.
// Servidor antigo sem getLikeQuota: o contador simplesmente não
// aparece (e não tenta de novo na mesma sessão).
// ============================================

import { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

export interface LikeQuota {
  used:  number;
  limit: number;
}

interface QuotaResponse { used: number; limit: number; date: string }

let current: { uid: string; quota: LikeQuota } | null = null;
let fetchedFor: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach(listener => listener());
}

function isValid(used: unknown, limit: unknown): used is number {
  return typeof used === 'number' && typeof limit === 'number' && limit > 0 && used >= 0;
}

/** Número novo vindo do servidor (resposta da curtida). */
export function setLikeQuota(uid: string, used: unknown, limit: unknown): void {
  if (!uid || !isValid(used, limit)) return;
  current = { uid, quota: { used, limit: limit as number } };
  notify();
}

/** O servidor recusou por limite: a cota de hoje acabou. */
export function markLikeQuotaFull(uid: string): void {
  if (!current || current.uid !== uid) return;
  current = { uid, quota: { ...current.quota, used: current.quota.limit } };
  notify();
}

async function fetchOnce(uid: string): Promise<void> {
  if (fetchedFor === uid) return;
  fetchedFor = uid;
  try {
    const fn = httpsCallable<void, QuotaResponse>(getFunctions(), 'getLikeQuota');
    const res = await fn();
    setLikeQuota(uid, res.data?.used, res.data?.limit);
  } catch (error) {
    // Servidor sem a função ou sem rede: o contador fica escondido.
    console.warn('[likeQuota] indisponível:', (error as { code?: string })?.code ?? error);
  }
}

/**
 * Cota de curtidas de hoje. `enabled` falso não faz chamada nenhuma
 * (ex.: celular, onde o contador não aparece).
 */
export function useLikeQuota(uid: string | undefined, enabled: boolean): LikeQuota | null {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  useEffect(() => {
    if (enabled && uid) fetchOnce(uid);
  }, [uid, enabled]);

  if (!uid || !current || current.uid !== uid) return null;
  return current.quota;
}

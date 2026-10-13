// ============================================
// LUMINA — QUEM NÃO PODE APARECER PARA MIM (BLOQUEIOS)
// src/services/blockedUsersService.ts
//
// 13/10/2026. A Home, o Sintonize e o Em Alta mostravam quem você
// bloqueou e quem te bloqueou — a curtida já era barrada no
// servidor, mas o card aparecia. Agora as três listas tiram os dois
// lados do bloqueio.
//
// Duas consultas (blockerId == eu, blockedId == eu), permitidas pela
// regra de blocks. Cache curto em memória: as três listas pedem o
// mesmo conjunto na mesma sessão, e ler de novo a cada página
// custaria leituras à toa. Bloquear alguém limpa o cache
// (invalidateBlockedUids), para o card sumir na próxima busca.
// ============================================

import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../core/firebase';

const CACHE_MS = 2 * 60 * 1000;
/** Teto por consulta — bem acima do uso normal. */
const MAX_BLOCKS = 500;

let cache: { uid: string; at: number; ids: Set<string> } | null = null;

/** uids que você bloqueou + uids que bloquearam você. */
export async function getBlockedUids(uid: string): Promise<Set<string>> {
  if (!uid) return new Set();
  if (cache && cache.uid === uid && Date.now() - cache.at < CACHE_MS) return cache.ids;

  const [mine, theirs] = await Promise.all([
    getDocs(query(collection(db, 'blocks'), where('blockerId', '==', uid), limit(MAX_BLOCKS))),
    getDocs(query(collection(db, 'blocks'), where('blockedId', '==', uid), limit(MAX_BLOCKS))),
  ]);

  const ids = new Set<string>();
  mine.docs.forEach(d => { const id = d.data().blockedId; if (typeof id === 'string') ids.add(id); });
  theirs.docs.forEach(d => { const id = d.data().blockerId; if (typeof id === 'string') ids.add(id); });

  cache = { uid, at: Date.now(), ids };
  return ids;
}

/**
 * Versão que nunca falha: sem a lista (rede, regra), a tela segue
 * sem o filtro em vez de ficar vazia. O servidor continua barrando
 * curtida e conversa entre bloqueados.
 */
export async function getBlockedUidsSafe(uid: string): Promise<Set<string>> {
  try {
    return await getBlockedUids(uid);
  } catch (error) {
    console.warn('[blockedUsersService] lista de bloqueios indisponível:', error);
    return new Set();
  }
}

/** Chame depois de bloquear ou desbloquear alguém. */
export function invalidateBlockedUids(): void {
  cache = null;
}

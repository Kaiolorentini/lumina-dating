// ============================================
// LUMINA — FILA DO SINTONIZE
// src/services/sintonizeService.ts
//
// A aba Sintonize mostra UM perfil por vez, para decidir. A
// grade da Home é para varrer; aqui é para escolher.
//
// ── POR QUE UM SERVIÇO SEPARADO ──
//
// A grade quer volume e aceita repetir; o Sintonize precisa
// excluir quem já foi curtido e quem foi descartado nas
// últimas 24h. Compartilhar a busca pareceria econômico, mas
// as duas telas descartariam coisas diferentes do mesmo lote.
//
// ── O CUSTO DO DESCARTE ──
//
// Os descartados ficam em `progression.dismissedProfiles`, um
// mapa de uid para timestamp. Filtrar isso no Firestore exigiria
// um `not-in`, que tem limite de 10 valores — inviável. Então
// buscamos MAIS do que vamos mostrar e filtramos no cliente:
// 20 por vez, e busca nova quando a fila chega a 3. A pessoa
// nunca espera carregamento entre um card e outro.
// ============================================

import {
  collection, getDocs, query, where, orderBy, limit, startAfter,
  QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';
import { calcularSintonia } from '../utils/sintoniaEngine';
import { RealProfile } from './usersService';

/** Buscados por vez. Maior que o exibido porque parte é
 *  filtrada: descartados, curtidos, perfis incompletos. */
const FETCH_SIZE = 20;

/** Quando a fila chega aqui, busca mais em segundo plano. */
export const REFILL_THRESHOLD = 3;

/** Descarte expira em 24h — depois disso a pessoa volta à fila. */
const DISMISS_HOURS = 24;

export interface SintonizePage {
  profiles: RealProfile[];
  cursor:   QueryDocumentSnapshot<DocumentData> | null;
  seed:     number;
  wrapped:  boolean;
  /** false quando a base acabou de verdade. */
  hasMore:  boolean;
}

/**
 * Uids descartados que ainda estão dentro das 24h.
 *
 * O mapa vive no documento do próprio usuário, então não custa
 * leitura extra: o perfil já foi carregado pela tela.
 */
export function activeDismissals(
  dismissed: Record<string, unknown> | undefined,
): Set<string> {
  const active = new Set<string>();
  if (!dismissed) return active;

  const cutoff = Date.now() - DISMISS_HOURS * 3600 * 1000;

  for (const [uid, value] of Object.entries(dismissed)) {
    const at = (value as { toDate?: () => Date })?.toDate?.()?.getTime()
      ?? (typeof value === 'number' ? value : 0);
    if (at > cutoff) active.add(uid);
  }

  return active;
}

function buildProfile(
  docSnap: QueryDocumentSnapshot<DocumentData>,
  currentUser: UserProfile,
): RealProfile | null {
  const data = docSnap.data() as UserProfile;

  if (data.uid === currentUser.uid) return null;
  if (!data.name || !data.age || !data.gender) return null;
  if ((data as { isBlocked?: boolean }).isBlocked === true) return null;

  const sintoniaResult = calcularSintonia(currentUser, data);
  const prog = (docSnap.data() as { progression?: Record<string, unknown> })?.progression ?? {};

  return {
    ...data,
    sintonia:      sintoniaResult.score,
    sintoniaLabel: sintoniaResult.label,
    // Boost não se aplica aqui: o Sintonize é aleatório por
    // definição, e deixar quem pagou furar a fila seria vender
    // posição num lugar onde só existe um card por vez.
    boostScore: 0,
    boostType:  null,
    equippedFrame:       (prog.equippedFrame as string) ?? null,
    equippedBadge:       (prog.equippedBadge as string) ?? null,
    equippedBadgeRarity: (prog.equippedBadgeRarity as string) ?? null,
    equippedTitle:       (prog.equippedTitle as string) ?? null,
    prestigeStage:       (prog.prestigeStage as number) ?? 0,
  };
}

export async function fetchSintonizePage(
  currentUser: UserProfile,
  dismissedUids: Set<string>,
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
  seed: number | null = null,
  wrapped: boolean = false,
): Promise<SintonizePage> {
  try {
    const startSeed = seed ?? Math.random();

    const constraints = cursor
      ? [orderBy('randomSeed', 'asc'), startAfter(cursor), limit(FETCH_SIZE)]
      : [orderBy('randomSeed', 'asc'), where('randomSeed', '>=', startSeed), limit(FETCH_SIZE)];

    const snapshot = await getDocs(query(collection(db, 'users'), ...constraints));
    let docs = snapshot.docs;
    let didWrap = wrapped;

    // Página incompleta e sem a volta: completa do início da
    // faixa. Quem sorteia 0.9 veria pouquíssimos perfis.
    if (docs.length < FETCH_SIZE && !wrapped) {
      didWrap = true;
      const wrapSnap = await getDocs(query(
        collection(db, 'users'),
        orderBy('randomSeed', 'asc'),
        where('randomSeed', '<', startSeed),
        limit(FETCH_SIZE - docs.length),
      ));
      docs = [...docs, ...wrapSnap.docs];
    }

    const profiles: RealProfile[] = [];
    docs.forEach((docSnap) => {
      if (dismissedUids.has(docSnap.id)) return;
      const profile = buildProfile(docSnap, currentUser);
      if (profile) profiles.push(profile);
    });

    return {
      profiles,
      cursor:  docs.length > 0 ? docs[docs.length - 1] : null,
      seed:    startSeed,
      wrapped: didWrap,
      hasMore: docs.length === FETCH_SIZE && !didWrap,
    };
  } catch (error) {
    console.error('[sintonizeService] fetchSintonizePage:', error);
    return { profiles: [], cursor: null, seed: 0, wrapped: false, hasMore: false };
  }
}
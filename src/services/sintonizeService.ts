// ============================================
// LUMINA — FILA DO SINTONIZE v2.1
// src/services/sintonizeService.ts
//
// v2.1 (27/09) — SEGUNDA CHANCE: lista de quem foi passado nas
// últimas 24h (fetchDismissedProfiles) e a chamada paga que traz
// de volta (bringBackProfile → CF secondChance).
//
// v2.0 (27/09) — TURBO NO SINTONIZE: só na primeira página, no
// máximo 3, só para quem tem preferência compatível, descarte de
// 24h vale normalmente, com selo de posição paga.
//
// ── O CUSTO DO DESCARTE ──
// Os descartados ficam em progression.dismissedProfiles. Filtrar
// no Firestore exigiria not-in (limite de 10). Buscamos MAIS e
// filtramos no cliente: 20 por vez, reabastece em 3.
// ============================================

import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter, Timestamp,
  QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebase';
import { UserProfile } from '../types';
import { calcularSintonia } from '../utils/sintoniaEngine';
import { RealProfile } from './usersService';

const FETCH_SIZE = 20;

export const REFILL_THRESHOLD = 3;

const DISMISS_HOURS = 24;

/** Máximo de perfis com Turbo no começo da sessão. */
const TURBO_SLOTS = 3;

/** Quantos passados a lista da Segunda Chance mostra. */
const DISMISSED_LIST_LIMIT = 20;

/**
 * Preferência → gêneros. Espelha functions/src/utils/compatibility.ts.
 * Manter em sincronia.
 */
const PREFERENCE_TO_GENDERS: Record<string, string[]> = {
  homens:   ['masculino'],
  mulheres: ['feminino'],
  trans:    ['trans'],
  todos:    ['masculino', 'feminino', 'trans', 'nao-binario'],
};

function viewerAccepts(viewer: UserProfile, gender: unknown): boolean {
  const prefs = ((viewer as { preferences?: string[] }).preferences) ?? [];
  if (prefs.length === 0) return true;
  if (typeof gender !== 'string') return false;
  return prefs.some(p => (PREFERENCE_TO_GENDERS[p] ?? []).includes(gender));
}

export interface SintonizePage {
  profiles: RealProfile[];
  cursor:   QueryDocumentSnapshot<DocumentData> | null;
  seed:     number;
  wrapped:  boolean;
  hasMore:  boolean;
}

/** Perfil passado, com quando foi passado. */
export interface DismissedProfile extends RealProfile {
  dismissedAt: number;
}

/** Descartes dentro das 24h: uid → quando (ms). */
export function activeDismissalMap(
  dismissed: Record<string, unknown> | undefined,
): Record<string, number> {
  const active: Record<string, number> = {};
  if (!dismissed) return active;

  const cutoff = Date.now() - DISMISS_HOURS * 3600 * 1000;

  for (const [uid, value] of Object.entries(dismissed)) {
    const at = (value as { toDate?: () => Date })?.toDate?.()?.getTime()
      ?? (typeof value === 'number' ? value : 0);
    if (at > cutoff) active[uid] = at;
  }

  return active;
}

export function activeDismissals(
  dismissed: Record<string, unknown> | undefined,
): Set<string> {
  return new Set(Object.keys(activeDismissalMap(dismissed)));
}

/** Monta o perfil a partir do documento — serve à fila e à lista de passados. */
function buildFromData(
  id: string,
  raw: DocumentData,
  currentUser: UserProfile,
): RealProfile | null {
  const data = { ...raw, uid: (raw.uid as string) ?? id } as UserProfile;

  if (data.uid === currentUser.uid) return null;
  if (!data.name || !data.age || !data.gender) return null;
  if ((data as { isBlocked?: boolean }).isBlocked === true) return null;

  const sintoniaResult = calcularSintonia(currentUser, data);
  const prog = (raw as { progression?: Record<string, unknown> }).progression ?? {};

  return {
    ...data,
    sintonia:      sintoniaResult.score,
    sintoniaLabel: sintoniaResult.label,
    boostScore: 0,
    boostType:  null,
    equippedFrame:       (prog.equippedFrame as string) ?? null,
    equippedBadge:       (prog.equippedBadge as string) ?? null,
    equippedBadgeRarity: (prog.equippedBadgeRarity as string) ?? null,
    equippedTitle:       (prog.equippedTitle as string) ?? null,
    prestigeStage:       (prog.prestigeStage as number) ?? 0,
  };
}

function buildProfile(
  docSnap: QueryDocumentSnapshot<DocumentData>,
  currentUser: UserProfile,
): RealProfile | null {
  return buildFromData(docSnap.id, docSnap.data(), currentUser);
}

/** Até TURBO_SLOTS perfis com Turbo ativo, compatíveis e não descartados. */
async function fetchTurboProfiles(
  currentUser: UserProfile,
  dismissedUids: Set<string>,
): Promise<RealProfile[]> {
  const snap = await getDocs(query(
    collection(db, 'users'),
    where('boostType', '==', 'turbo'),
    where('boostActiveUntil', '>', Timestamp.now()),
    orderBy('boostActiveUntil', 'desc'),
    limit(10),
  ));

  const out: RealProfile[] = [];
  for (const docSnap of snap.docs) {
    if (out.length >= TURBO_SLOTS) break;
    if (dismissedUids.has(docSnap.id)) continue;
    if (!viewerAccepts(currentUser, docSnap.data().gender)) continue;
    const profile = buildProfile(docSnap, currentUser);
    if (profile) out.push({ ...profile, boostType: 'turbo', boostScore: 180 });
  }
  return out;
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
    const isFirst   = cursor === null;

    const constraints = cursor
      ? [orderBy('randomSeed', 'asc'), startAfter(cursor), limit(FETCH_SIZE)]
      : [orderBy('randomSeed', 'asc'), where('randomSeed', '>=', startSeed), limit(FETCH_SIZE)];

    const [snapshot, turbo] = await Promise.all([
      getDocs(query(collection(db, 'users'), ...constraints)),
      isFirst
        ? fetchTurboProfiles(currentUser, dismissedUids).catch((error): RealProfile[] => {
            console.error('[sintonizeService] Turbo:', error);
            return [];
          })
        : Promise.resolve<RealProfile[]>([]),
    ]);

    let docs = snapshot.docs;
    let didWrap = wrapped;

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

    const turboIds = new Set(turbo.map(p => p.uid));
    const profiles: RealProfile[] = [...turbo];

    docs.forEach((docSnap) => {
      if (dismissedUids.has(docSnap.id)) return;
      if (turboIds.has(docSnap.id)) return;
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

/**
 * Passados nas últimas 24h, do mais recente ao mais antigo, para a
 * Segunda Chance. Lê só os DISMISSED_LIST_LIMIT mais recentes.
 */
export async function fetchDismissedProfiles(
  currentUser: UserProfile,
  dismissedAt: Record<string, number>,
): Promise<DismissedProfile[]> {
  const recent = Object.entries(dismissedAt)
    .sort((a, b) => b[1] - a[1])
    .slice(0, DISMISSED_LIST_LIMIT);

  const snaps = await Promise.all(
    recent.map(([id]) => getDoc(doc(db, 'users', id)).catch(() => null)),
  );

  const out: DismissedProfile[] = [];
  snaps.forEach((snap, i) => {
    if (!snap || !snap.exists()) return;
    const profile = buildFromData(snap.id, snap.data(), currentUser);
    if (profile) out.push({ ...profile, dismissedAt: recent[i][1] });
  });
  return out;
}

interface SecondChanceRequest { targetUid: string }
interface SecondChanceResponse {
  success:            boolean;
  cost:               number;
  spentFromGratuitos: number;
  spentFromPremium:   number;
}

/** Segunda Chance: cobra e desfaz o descarte no servidor. */
export async function bringBackProfile(targetUid: string): Promise<SecondChanceResponse> {
  const fn = httpsCallable<SecondChanceRequest, SecondChanceResponse>(getFunctions(), 'secondChance');
  const result = await fn({ targetUid });
  return result.data;
}
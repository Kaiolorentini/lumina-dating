// ============================================
// LUMINA — MOST VISITED SERVICE v6.2
// src/services/mostVisitedService.ts
//
// v6.2 (12/10/2026): lê publicProfiles — o documento users de outras
// pessoas fechou nas regras. Sintonia v2 (mesma do feed).
// 13/10/2026: bloqueios nos dois sentidos saem do Em Alta.
//
// v6.1:
// - O card leva também o FIM do boost (boostUntil), para a Home
//   tirar o selo quando ele vence sem buscar de novo. O isActive
//   saiu: o activeBoost agora devolve o prazo junto do tipo.
//
// v6.0 (27/09):
// - Perfis buscados EM PARALELO. Eram 20 leituras em série,
//   cada uma esperando a anterior — mesmo custo, Em Alta lento.
// - boostType no card, para o selo de posição paga.
// - getTurboProfileCards: perfis com Turbo ativo, para a seção
//   "Impulsionados agora". O RANKING continua orgânico — a medalha
//   é só de quem teve mais visitas de fato.
// ============================================

import {
  collection, query, where, orderBy, limit, getDocs, Timestamp,
} from 'firebase/firestore';
import { db }                      from './firebase';
import { getMostVisitedProfiles }  from './visitsService';
import { PUBLIC_PROFILES, getPublicProfile } from './publicProfileService';
import { getBlockedUidsSafe } from './blockedUsersService';
import { calcularSintonia }        from '../utils/sintoniaEngine';
import { isListableProfile } from '../shared/utils/profileVisibility';
import { UserProfile, ProfileCardData, BoostType } from '../shared/types';

interface ActiveBoostInfo {
  type:  BoostType | null;
  /** Fim do boost em ms. */
  until: number | null;
}

const NO_BOOST: ActiveBoostInfo = { type: null, until: null };

/**
 * Cosmético equipado, descartando aluguel vencido.
 * Duplica o usersService de propósito: aquele parte de um
 * QueryDocumentSnapshot, este de um UserProfile.
 */
function activeCosmetic(id: unknown, until: unknown): string | null {
  if (typeof id !== 'string' || !id) return null;
  if (until === null || until === undefined) return id;
  const date = (until as { toDate?: () => Date })?.toDate?.() ?? null;
  if (!date) return id;
  return date.getTime() > Date.now() ? id : null;
}

function expiryMs(expiresAt: unknown): number | null {
  const date = (expiresAt as { toDate?: () => Date })?.toDate?.() ?? null;
  return date ? date.getTime() : null;
}

/** Mesma precedência do usersService: Turbo, Destaque (só na mesma cidade), Impulso. */
function activeBoost(data: Record<string, any>, viewerRegiaoId: string | null): ActiveBoostInfo {
  const now = Date.now();

  const turbo = expiryMs(data.turbo?.expiresAt);
  if (turbo !== null && turbo > now) return { type: 'turbo', until: turbo };

  const destaque = expiryMs(data.destaqueRegional?.expiresAt);
  if (destaque !== null && destaque > now) {
    const target = data.destaqueRegional?.regiaoId ?? data.regiaoId ?? null;
    if (viewerRegiaoId && target === viewerRegiaoId) return { type: 'destaque', until: destaque };
  }

  const impulso = expiryMs(data.impulso?.expiresAt);
  if (impulso !== null && impulso > now) return { type: 'impulso', until: impulso };

  return NO_BOOST;
}

function toCard(
  profile: UserProfile,
  currentUser: UserProfile | null,
  boost: ActiveBoostInfo,
): ProfileCardData {
  const prog = (profile as { progression?: Record<string, unknown> })?.progression ?? {};
  return {
    id:         profile.uid,
    name:       profile.name,
    age:        profile.age,
    location:   `${profile.city || ''}, ${profile.state || ''}`,
    sintonia:   currentUser ? calcularSintonia(currentUser, profile).score : 50,
    photoURL:   profile.photoURL || 'https://randomuser.me/api/portraits/lego/1.jpg',
    boostType:  boost.type,
    boostUntil: boost.until,
    equippedFrame:       activeCosmetic(prog.equippedFrame, prog.equippedFrameUntil),
    equippedBadge:       activeCosmetic(prog.equippedBadge, prog.equippedBadgeUntil),
    equippedBadgeRarity: (prog.equippedBadgeRarity as string) ?? null,
    equippedTitle:       (prog.equippedTitle as string) ?? null,
    prestigeStage:       (prog.prestigeStage as number) ?? 0,
  };
}

function viewerRegion(currentUser: UserProfile | null): string | null {
  const id = (currentUser as { regiaoId?: unknown } | null)?.regiaoId;
  return typeof id === 'string' ? id : null;
}

export async function getMostVisitedProfileCards(
  currentUser: UserProfile | null,
  limitCount: number = 20,
): Promise<ProfileCardData[]> {
  try {
    const visitCounts = await getMostVisitedProfiles(limitCount);
    if (visitCounts.length === 0) return [];

    const [profiles, blocked] = await Promise.all([
      Promise.all(visitCounts.map(v => getPublicProfile(v.profileId).catch(() => null))),
      currentUser ? getBlockedUidsSafe(currentUser.uid) : Promise.resolve(new Set<string>()),
    ]);

    const region = viewerRegion(currentUser);
    const cards: ProfileCardData[] = [];

    profiles.forEach(profile => {
      if (!profile || !profile.name || !profile.age) return;
      if (!isListableProfile(profile)) return;
      if (currentUser && profile.uid === currentUser.uid) return;
      if (blocked.has(profile.uid)) return;
      cards.push(toCard(profile, currentUser, activeBoost(profile as Record<string, any>, region)));
    });

    return cards;
  } catch (error) {
    console.error('[mostVisitedService] Erro:', error);
    return [];
  }
}

/** Perfis com Turbo ativo, para "Impulsionados agora" no Em Alta. */
export async function getTurboProfileCards(
  currentUser: UserProfile | null,
  limitCount: number = 4,
): Promise<ProfileCardData[]> {
  try {
    const [snap, blocked] = await Promise.all([
      getDocs(query(
        collection(db, PUBLIC_PROFILES),
        where('boostType', '==', 'turbo'),
        where('boostActiveUntil', '>', Timestamp.now()),
        orderBy('boostActiveUntil', 'desc'),
        limit(limitCount + 1),
      )),
      currentUser ? getBlockedUidsSafe(currentUser.uid) : Promise.resolve(new Set<string>()),
    ]);

    const cards: ProfileCardData[] = [];
    snap.docs.forEach(docSnap => {
      const raw     = docSnap.data();
      const profile = raw as UserProfile;
      if (!profile.name || !profile.age) return;
      if (!isListableProfile(raw)) return;
      if ((profile as { isBlocked?: boolean }).isBlocked === true) return;
      if (currentUser && docSnap.id === currentUser.uid) return;
      if (blocked.has(docSnap.id)) return;
      cards.push(toCard(
        { ...profile, uid: docSnap.id },
        currentUser,
        { type: 'turbo', until: expiryMs(raw.boostActiveUntil) },
      ));
    });

    return cards.slice(0, limitCount);
  } catch (error) {
    console.error('[mostVisitedService] Turbo:', error);
    return [];
  }
}

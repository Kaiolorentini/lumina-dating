// ============================================
// LUMINA — MOST VISITED SERVICE v6.0
// src/services/mostVisitedService.ts
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
import { getProfile }              from './profileService';
import { calcularSintonia }        from '../utils/sintoniaEngine';
import { UserProfile, ProfileCardData, BoostType } from '../shared/types';

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

function isActive(expiresAt: unknown, now: number): boolean {
  const date = (expiresAt as { toDate?: () => Date })?.toDate?.() ?? null;
  return !!date && date.getTime() > now;
}

/** Mesma precedência do usersService: Turbo, Destaque (só na mesma cidade), Impulso. */
function activeBoostType(data: Record<string, any>, viewerRegiaoId: string | null): BoostType | null {
  const now = Date.now();
  if (isActive(data.turbo?.expiresAt, now)) return 'turbo';
  if (isActive(data.destaqueRegional?.expiresAt, now)) {
    const target = data.destaqueRegional?.regiaoId ?? data.regiaoId ?? null;
    if (viewerRegiaoId && target === viewerRegiaoId) return 'destaque';
  }
  if (isActive(data.impulso?.expiresAt, now)) return 'impulso';
  return null;
}

function toCard(
  profile: UserProfile,
  currentUser: UserProfile | null,
  boostType: BoostType | null,
): ProfileCardData {
  const prog = (profile as { progression?: Record<string, unknown> })?.progression ?? {};
  return {
    id:       profile.uid,
    name:     profile.name,
    age:      profile.age,
    location: `${profile.city || ''}, ${profile.state || ''}`,
    sintonia: currentUser ? calcularSintonia(currentUser, profile).score : 50,
    photoURL: profile.photoURL || 'https://randomuser.me/api/portraits/lego/1.jpg',
    boostType,
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

    const profiles = await Promise.all(
      visitCounts.map(v => getProfile(v.profileId).catch(() => null)),
    );

    const region = viewerRegion(currentUser);
    const cards: ProfileCardData[] = [];

    profiles.forEach(profile => {
      if (!profile || !profile.name || !profile.age) return;
      if (currentUser && profile.uid === currentUser.uid) return;
      cards.push(toCard(profile, currentUser, activeBoostType(profile as Record<string, any>, region)));
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
    const snap = await getDocs(query(
      collection(db, 'users'),
      where('boostType', '==', 'turbo'),
      where('boostActiveUntil', '>', Timestamp.now()),
      orderBy('boostActiveUntil', 'desc'),
      limit(limitCount + 1),
    ));

    const cards: ProfileCardData[] = [];
    snap.docs.forEach(docSnap => {
      const profile = docSnap.data() as UserProfile;
      if (!profile.name || !profile.age) return;
      if ((profile as { isBlocked?: boolean }).isBlocked === true) return;
      if (currentUser && docSnap.id === currentUser.uid) return;
      cards.push(toCard({ ...profile, uid: docSnap.id }, currentUser, 'turbo'));
    });

    return cards.slice(0, limitCount);
  } catch (error) {
    console.error('[mostVisitedService] Turbo:', error);
    return [];
  }
}
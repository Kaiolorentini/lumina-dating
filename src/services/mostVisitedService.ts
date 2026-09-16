// ============================================
// LUMINA — MOST VISITED SERVICE v5.1
// src/services/mostVisitedService.ts
//
// CORREÇÃO: isAI removido de ProfileCardData
// (IA foi removida do projeto v5.1)
// ============================================

import { getMostVisitedProfiles }  from './visitsService';
import { getProfile }              from './profileService';
import { calcularSintonia }        from '../utils/sintoniaEngine';
import { UserProfile }             from '../shared/types';
import { ProfileCardData }         from '../shared/types';

/**
 * Cosmético equipado, descartando aluguel vencido.
 *
 * Duplica a lógica do usersService de propósito: aquele monta o
 * perfil a partir de um QueryDocumentSnapshot, este parte de um
 * UserProfile já convertido. Unificar exigiria uma assinatura que
 * servisse mal aos dois.
 */
function activeCosmetic(id: unknown, until: unknown): string | null {
  if (typeof id !== 'string' || !id) return null;
  if (until === null || until === undefined) return id;  // permanente
  const date = (until as { toDate?: () => Date })?.toDate?.() ?? null;
  if (!date) return id;
  return date.getTime() > Date.now() ? id : null;
}

export async function getMostVisitedProfileCards(
  currentUser: UserProfile | null,
  limitCount: number = 20
): Promise<ProfileCardData[]> {
  try {
    const visitCounts = await getMostVisitedProfiles(limitCount);
    if (visitCounts.length === 0) return [];

    const profileCards: ProfileCardData[] = [];

    for (const visitCount of visitCounts) {
      try {
        const profile = await getProfile(visitCount.profileId);
        if (!profile || !profile.name || !profile.age) continue;
        if (currentUser && profile.uid === currentUser.uid) continue;

        let sintonia = 50;
        if (currentUser) {
          const result = calcularSintonia(currentUser, profile);
          sintonia = result.score;
        }

        const prog = (profile as { progression?: Record<string, unknown> })?.progression ?? {};

        profileCards.push({
          id:       profile.uid,
          name:     profile.name,
          age:      profile.age,
          location: `${profile.city || ''}, ${profile.state || ''}`,
          sintonia,
          photoURL: profile.photoURL || 'https://randomuser.me/api/portraits/lego/1.jpg',
          // FASE 5 Etapa 2 — moldura e badge na aba "Em Alta".
          equippedFrame:       activeCosmetic(prog.equippedFrame, prog.equippedFrameUntil),
          equippedBadge:       activeCosmetic(prog.equippedBadge, prog.equippedBadgeUntil),
          equippedBadgeRarity: (prog.equippedBadgeRarity as string) ?? null,
        });
      } catch {
        console.error('[mostVisitedService] Erro ao buscar perfil:', visitCount.profileId);
      }
    }

    return profileCards;
  } catch (error) {
    console.error('[mostVisitedService] Erro:', error);
    return [];
  }
}
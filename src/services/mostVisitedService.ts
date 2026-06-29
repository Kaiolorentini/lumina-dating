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
import { ProfileCardData }         from '../components/ProfileCard';

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

        profileCards.push({
          id:       profile.uid,
          name:     profile.name,
          age:      profile.age,
          location: `${profile.city || ''}, ${profile.state || ''}`,
          sintonia,
          photoURL: profile.photoURL || 'https://randomuser.me/api/portraits/lego/1.jpg',
          // isAI removido — IA não existe mais no projeto
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
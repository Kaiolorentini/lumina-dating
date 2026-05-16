import { getMostVisitedProfiles } from './visitsService';
import { getProfile } from './profileService';
import { calcularSintonia } from '../utils/sintoniaEngine';
import { UserProfile } from '../types';
import { ProfileCardData } from '../components/ProfileCard';

// ============================================
// SERVIÇO DE PERFIS MAIS VISITADOS
//
// Busca os perfis com mais visitas e retorna
// no formato ProfileCardData para exibir no feed
// ============================================

export async function getMostVisitedProfileCards(
  currentUser: UserProfile | null,
  limitCount: number = 20
): Promise<ProfileCardData[]> {
  try {
    // Busca os IDs mais visitados ordenados por total
    const visitCounts = await getMostVisitedProfiles(limitCount);

    if (visitCounts.length === 0) return [];

    // Busca os dados de cada perfil
    const profileCards: ProfileCardData[] = [];

    for (const visitCount of visitCounts) {
      try {
        const profile = await getProfile(visitCount.profileId);

        // Ignora perfis inválidos ou o próprio usuário
        if (!profile || !profile.name || !profile.age) continue;
        if (currentUser && profile.uid === currentUser.uid) continue;

        // Calcula Sintonia se tiver usuário logado
        let sintonia = 50;
        if (currentUser) {
          const result = calcularSintonia(currentUser, profile);
          sintonia = result.score;
        }

        profileCards.push({
          id: profile.uid,
          name: profile.name,
          age: profile.age,
          location: `${profile.city || ''}, ${profile.state || ''}`,
          sintonia,
          photoURL: profile.photoURL || 'https://randomuser.me/api/portraits/lego/1.jpg',
          isAI: false,
        });
      } catch (error) {
        console.error('Erro ao buscar perfil:', visitCount.profileId);
      }
    }

    return profileCards;
  } catch (error) {
    console.error('Erro ao buscar mais visitados:', error);
    return [];
  }
}
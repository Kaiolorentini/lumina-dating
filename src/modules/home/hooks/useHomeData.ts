import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useCoins } from '../../../context/CoinsContext';
import { useNotifications } from '../../notifications/hooks/useNotifications';
import { useVisits } from '../../../hooks/useVisits';
import { getProfile } from '../../profile/services/profileService';
import { getCompatibleProfiles } from '../../../services/usersService';
import { getMostVisitedProfileCards } from '../../../services/mostVisitedService';
import { getMostVisitedProfiles } from '../../../services/visitsService';
import { registrarVisita } from '../../../services/visitsService';
import { generateAutoNotifications } from '../../notifications/services/notificationService';
import { AI_MODELS } from '../../ai/data/aiModels';
import { calcularSintoniaIA } from '../../ai/services/sintoniaCalculator';
import { ProfileCardData } from '../../../shared/types';
import { UserProfile } from '../../../shared/types';

// ============================================
// useHomeData
//
// Hook central da Home.
// Busca todos os dados necessários:
// - Modelos IA com Sintonia calculada
// - Perfis reais compatíveis
// - Perfis mais visitados
// - Contadores de visitas
// Screen não precisa saber como buscar.
// ============================================

export type HomeTab = 'ia' | 'perfis' | 'visitados' | 'conversas';

interface UseHomeDataReturn {
  // Dados
  aiModels: ProfileCardData[];
  realProfiles: ProfileCardData[];
  mostVisited: ProfileCardData[];
  visitCounts: Record<string, number>;
  userProfile: UserProfile | null;

  // Estado
  loadingVisited: boolean;

  // Notificações e visitas
  visitasHoje: number;
  unreadCount: number;

  // Moedas
  coins: number;

  // Ações
  loadMostVisited: () => Promise<void>;
}

export function useHomeData(): UseHomeDataReturn {
  const { user } = useAuth();
  const { wallet } = useCoins();
  const { unreadCount } = useNotifications(user?.uid);
  const { visitasHoje, refresh: refreshVisits } = useVisits(user?.uid);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [aiModels, setAiModels] = useState<ProfileCardData[]>(
    AI_MODELS.map(m => ({ ...m, isAI: true }))
  );
  const [realProfiles, setRealProfiles] = useState<ProfileCardData[]>([]);
  const [mostVisited, setMostVisited] = useState<ProfileCardData[]>([]);
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({});
  const [loadingVisited, setLoadingVisited] = useState(false);

  // Carrega dados ao montar
  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user]);

  async function loadInitialData() {
    if (!user) return;

    try {
      const profile = await getProfile(user.uid);
      if (profile) {
        setUserProfile(profile);

        // Atualiza Sintonia dos modelos IA
        setAiModels(AI_MODELS.map(model => ({
          ...model,
          sintonia: calcularSintoniaIA(profile),
          isAI: true,
        })));

        // Carrega perfis reais compatíveis
        const compatible = await getCompatibleProfiles(profile);
        setRealProfiles(compatible.map(p => ({
          id: p.uid,
          name: p.name,
          age: p.age,
          location: `${p.city || ''}, ${p.state || ''}`,
          sintonia: p.sintonia,
          photoURL: p.photoURL ||
            'https://randomuser.me/api/portraits/lego/1.jpg',
          isAI: false,
        })));
      }

      // Simula visitas para demonstração
      await simulateVisits(user.uid);
      await refreshVisits();

      // Gera notificações automáticas
      await generateAutoNotifications(user.uid);
    } catch (error) {
      console.error('useHomeData error:', error);
    }
  }

  async function simulateVisits(userId: string) {
    const fakeVisitors = ['visitor_1', 'visitor_2', 'visitor_3'];
    for (const visitorId of fakeVisitors) {
      await registrarVisita(visitorId, userId);
    }
  }

  // Carrega mais visitados sob demanda
  async function loadMostVisited() {
    if (!userProfile) return;
    setLoadingVisited(true);
    try {
      const cards = await getMostVisitedProfileCards(userProfile, 20);
      setMostVisited(cards);

      const counts = await getMostVisitedProfiles(20);
      const countsMap: Record<string, number> = {};
      counts.forEach(c => { countsMap[c.profileId] = c.totalVisits; });
      setVisitCounts(countsMap);
    } catch (error) {
      console.error('loadMostVisited error:', error);
    } finally {
      setLoadingVisited(false);
    }
  }

  return {
    aiModels,
    realProfiles,
    mostVisited,
    visitCounts,
    userProfile,
    loadingVisited,
    visitasHoje,
    unreadCount,
    coins: wallet?.coins || 0,
    loadMostVisited,
  };
}
// ============================================
// LUMINA — USE HOME DATA v5.2
// src/modules/home/hooks/useHomeData.ts
//
// v5.2: removida simulateVisits() — visitas fictícias
// de visitor_1/2/3 removidas da produção.
// Visitas agora só ocorrem quando um usuário real visita o perfil.
// ============================================

import { useState, useEffect } from 'react';
import { useAuth }          from '../../../context/AuthContext';
import { useCoins }         from '../../../context/CoinsContext';
import { useNotifications } from '../../notifications/hooks/useNotifications';
import { useVisits }        from '../../../hooks/useVisits';
import { getProfile }       from '../../profile/services/profileService';
import { getCompatibleProfiles }     from '../../../services/usersService';
import { getMostVisitedProfileCards } from '../../../services/mostVisitedService';
import { getMostVisitedProfiles }    from '../../../services/visitsService';
import { ProfileCardData, UserProfile } from '../../../shared/types';

export type HomeTab = 'perfis' | 'visitados' | 'conversas';

interface UseHomeDataReturn {
  realProfiles:    ProfileCardData[];
  mostVisited:     ProfileCardData[];
  visitCounts:     Record<string, number>;
  userProfile:     UserProfile | null;
  loadingVisited:  boolean;
  visitasHoje:     number;
  unreadCount:     number;
  coins:           number;
  loadMostVisited: () => Promise<void>;
}

export function useHomeData(): UseHomeDataReturn {
  const { user }                               = useAuth();
  const { wallet }                             = useCoins();
  const { unreadCount }                        = useNotifications(user?.uid);
  const { visitasHoje, refresh: refreshVisits } = useVisits(user?.uid);

  const [userProfile,    setUserProfile]    = useState<UserProfile | null>(null);
  const [realProfiles,   setRealProfiles]   = useState<ProfileCardData[]>([]);
  const [mostVisited,    setMostVisited]    = useState<ProfileCardData[]>([]);
  const [visitCounts,    setVisitCounts]    = useState<Record<string, number>>({});
  const [loadingVisited, setLoadingVisited] = useState(false);

  useEffect(() => {
    if (user) loadInitialData();
  }, [user]);

  async function loadInitialData() {
    if (!user) return;
    try {
      const profile = await getProfile(user.uid);
      if (profile) {
        setUserProfile(profile);
        const compatible = await getCompatibleProfiles(profile);
        setRealProfiles(
          compatible.map(p => ({
            id:       p.uid,
            name:     p.name,
            age:      p.age,
            location: `${p.city || ''}, ${p.state || ''}`,
            sintonia: p.sintonia,
            photoURL: p.photoURL || 'https://randomuser.me/api/portraits/lego/1.jpg',
          }))
        );
      }
      await refreshVisits();
    } catch (error) {
      console.error('[useHomeData] error:', error);
    }
  }

  async function loadMostVisited() {
    if (!userProfile) return;
    setLoadingVisited(true);
    try {
      const cards  = await getMostVisitedProfileCards(userProfile, 20);
      setMostVisited(cards);
      const counts = await getMostVisitedProfiles(20);
      const countsMap: Record<string, number> = {};
      counts.forEach(c => { countsMap[c.profileId] = c.totalVisits; });
      setVisitCounts(countsMap);
    } catch (error) {
      console.error('[useHomeData] loadMostVisited error:', error);
    } finally {
      setLoadingVisited(false);
    }
  }

  const totalCoins = (wallet?.coinsGratuitos ?? 0) + (wallet?.coinsPremium ?? 0);

  return {
    realProfiles, mostVisited, visitCounts, userProfile,
    loadingVisited, visitasHoje, unreadCount,
    coins: totalCoins, loadMostVisited,
  };
}
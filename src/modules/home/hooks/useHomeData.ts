// ============================================
// LUMINA — USE HOME DATA v5.3
// src/modules/home/hooks/useHomeData.ts
//
// v5.3:
// - Paginação por cursor. A Home carrega PROFILE_PAGE_SIZE
//   perfis e busca mais conforme o usuário rola.
// - boostType propagado até o card (o .map anterior descartava
//   boostScore e o badge nunca teria como saber qual boost está
//   ativo).
// - errorProfiles: o catch anterior só fazia console.error e
//   deixava a tela em estado ambíguo — sem erro visível e sem
//   dados. Agora o erro sobe para a tela.
//
// v5.2: removida simulateVisits() — visitas fictícias
// de visitor_1/2/3 removidas da produção.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useAuth }          from '../../../context/AuthContext';
import { useCoins }         from '../../../context/CoinsContext';
import { useNotifications } from '../../notifications/hooks/useNotifications';
import { useVisits }        from '../../../hooks/useVisits';
import { getProfile }       from '../../profile/services/profileService';
import {
  getCompatibleProfilesPage,
  PROFILE_PAGE_SIZE,
  RealProfile,
} from '../../../services/usersService';
import { getMostVisitedProfileCards } from '../../../services/mostVisitedService';
import { getMostVisitedProfiles }     from '../../../services/visitsService';
import { ProfileCardData, UserProfile } from '../../../shared/types';

export type HomeTab = 'perfis' | 'visitados' | 'conversas';

interface UseHomeDataReturn {
  realProfiles:    ProfileCardData[];
  mostVisited:     ProfileCardData[];
  visitCounts:     Record<string, number>;
  userProfile:     UserProfile | null;
  loadingProfiles: boolean;
  loadingMore:     boolean;
  hasMoreProfiles: boolean;
  errorProfiles:   string | null;
  loadingVisited:  boolean;
  visitasHoje:     number;
  totalVisitas:    number;
  unreadCount:     number;
  coins:           number;
  loadMostVisited:    () => Promise<void>;
  loadMoreProfiles:   () => Promise<void>;
  refreshProfiles:    () => Promise<void>;
}

function toCardData(p: RealProfile): ProfileCardData {
  return {
    id:        p.uid,
    name:      p.name,
    age:       p.age,
    location:  `${p.city || ''}, ${p.state || ''}`,
    sintonia:  p.sintonia,
    photoURL:  p.photoURL || 'https://randomuser.me/api/portraits/lego/1.jpg',
    boostType: p.boostType,
    // FASE 5 Etapa 2 — já vêm filtrados por validade do
    // usersService; aqui é só repasse.
    equippedFrame:       p.equippedFrame,
    equippedBadge:       p.equippedBadge,
    equippedBadgeRarity: p.equippedBadgeRarity,
  };
}

export function useHomeData(): UseHomeDataReturn {
  const { user }                                = useAuth();
  const { wallet }                              = useCoins();
  const { unreadCount }                         = useNotifications(user?.uid);
  const { visitasHoje, totalVisitas, refresh: refreshVisits } = useVisits(user?.uid);

  const [userProfile,     setUserProfile]     = useState<UserProfile | null>(null);
  const [realProfiles,    setRealProfiles]    = useState<ProfileCardData[]>([]);
  const [mostVisited,     setMostVisited]     = useState<ProfileCardData[]>([]);
  const [visitCounts,     setVisitCounts]     = useState<Record<string, number>>({});
  const [loadingVisited,  setLoadingVisited]  = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingMore,     setLoadingMore]     = useState(false);
  const [hasMoreProfiles, setHasMoreProfiles] = useState(true);
  const [errorProfiles,   setErrorProfiles]   = useState<string | null>(null);

  // Cursor fora do state: mudá-lo não deve disparar re-render,
  // e precisa estar sempre atualizado dentro de loadMoreProfiles.
  const cursorRef  = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  // Trava reentrante: o onScroll dispara várias vezes durante o
  // gesto e sem isso a mesma página seria pedida repetidas vezes.
  const loadingRef = useRef(false);
  const profileRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    if (user) loadInitialData();
  }, [user]);

  async function loadInitialData() {
    if (!user) return;

    setLoadingProfiles(true);
    setErrorProfiles(null);

    try {
      const profile = await getProfile(user.uid);

      if (!profile) {
        setErrorProfiles('Não foi possível carregar seu perfil.');
        return;
      }

      setUserProfile(profile);
      profileRef.current = profile;

      const page = await getCompatibleProfilesPage(profile, PROFILE_PAGE_SIZE, null);

      cursorRef.current = page.cursor;
      setRealProfiles(page.profiles.map(toCardData));
      setHasMoreProfiles(page.hasMore);

      await refreshVisits();
    } catch (error) {
      console.error('[useHomeData] loadInitialData:', error);
      setErrorProfiles('Não foi possível carregar os perfis. Tente novamente.');
    } finally {
      // Sempre liberado — silent failure com loading eterno é
      // o padrão de falha mais recorrente deste projeto.
      setLoadingProfiles(false);
    }
  }

  const loadMoreProfiles = useCallback(async () => {
    const profile = profileRef.current;

    if (!profile)              return;
    if (loadingRef.current)    return;
    if (!hasMoreProfiles)      return;
    if (cursorRef.current === null) return;

    loadingRef.current = true;
    setLoadingMore(true);

    try {
      const page = await getCompatibleProfilesPage(
        profile,
        PROFILE_PAGE_SIZE,
        cursorRef.current,
      );

      cursorRef.current = page.cursor;
      setHasMoreProfiles(page.hasMore);

      // Deduplica na junção: um perfil fixado pelo boost na
      // primeira página pode reaparecer numa página posterior.
      setRealProfiles(prev => {
        const seen = new Set(prev.map(p => p.id));
        const fresh = page.profiles
          .map(toCardData)
          .filter(p => !seen.has(p.id));
        return [...prev, ...fresh];
      });
    } catch (error) {
      console.error('[useHomeData] loadMoreProfiles:', error);
      // Não sobrescreve a lista já carregada — encerra a
      // paginação para não repetir a falha a cada scroll.
      setHasMoreProfiles(false);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMoreProfiles]);

  const refreshProfiles = useCallback(async () => {
    cursorRef.current = null;
    setHasMoreProfiles(true);
    setRealProfiles([]);
    await loadInitialData();
  }, [user]);

  async function loadMostVisited() {
    const profile = profileRef.current ?? userProfile;
    if (!profile) return;

    setLoadingVisited(true);
    try {
      const cards  = await getMostVisitedProfileCards(profile, 20);
      setMostVisited(cards);

      const counts = await getMostVisitedProfiles(20);
      const countsMap: Record<string, number> = {};
      counts.forEach(c => { countsMap[c.profileId] = c.totalVisits; });
      setVisitCounts(countsMap);
    } catch (error) {
      console.error('[useHomeData] loadMostVisited:', error);
    } finally {
      setLoadingVisited(false);
    }
  }

  const totalCoins = (wallet?.coinsGratuitos ?? 0) + (wallet?.coinsPremium ?? 0);

  return {
    realProfiles, mostVisited, visitCounts, userProfile,
    loadingProfiles, loadingMore, hasMoreProfiles, errorProfiles,
    loadingVisited, visitasHoje, totalVisitas, unreadCount,
    coins: totalCoins,
    loadMostVisited, loadMoreProfiles, refreshProfiles,
  };
}
import { useState, useEffect } from 'react';
import {
  getVisitasHoje,
  getTotalVisitas,
  registrarVisita,
} from '../services/visitsService';

// ============================================
// HOOK DE VISITAS
//
// Como usar em qualquer tela:
//
// const { visitasHoje, totalVisitas } = useVisits(userId);
//
// Para registrar uma visita:
// await registrarVisita(visitorId, profileId);
// ============================================

interface UseVisitsReturn {
  visitasHoje: number;
  totalVisitas: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useVisits(profileId: string | undefined): UseVisitsReturn {
  const [visitasHoje, setVisitasHoje] = useState(0);
  const [totalVisitas, setTotalVisitas] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadVisitas() {
    if (!profileId) {
      setLoading(false);
      return;
    }
    try {
      const [hoje, total] = await Promise.all([
        getVisitasHoje(profileId),
        getTotalVisitas(profileId),
      ]);
      setVisitasHoje(hoje);
      setTotalVisitas(total);
    } catch (error) {
      console.error('Erro ao carregar visitas:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVisitas();
  }, [profileId]);

  return {
    visitasHoje,
    totalVisitas,
    loading,
    refresh: loadVisitas,
  };
}

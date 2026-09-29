// ============================================
// LUMINA — HOOK DO PAINEL ADMIN
// src/hooks/useAdminDashboard.ts
//
// Pendentes e métricas do servidor. Recarrega ao voltar para a tela
// (depois de aprovar algo, o balão já cai).
// ============================================

import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  fetchAdminDashboard, AdminDashboardData,
} from '../services/marketplace/adminDashboardService';

export function useAdminDashboard(enabled = true) {
  const [data, setData]         = useState<AdminDashboardData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
    if (!enabled) return;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      setData(await fetchAdminDashboard());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o painel.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled]);

  useFocusEffect(useCallback(() => {
    load(loadedOnce.current ? 'silent' : 'initial');
    loadedOnce.current = true;
  }, [load]));

  return { data, loading, refreshing, error, refresh: () => load('refresh') };
}
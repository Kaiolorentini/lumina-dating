// ============================================
// LUMINA — PENDÊNCIAS DO ADMIN (balão da aba)
// src/hooks/useAdminPendingTotal.ts
//
// Total de itens aguardando o admin, para o balão da aba Admin.
// Atualiza ao abrir o app, ao voltar do segundo plano e a cada
// 5 minutos — só para quem vê a aba.
// ============================================

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { fetchAdminDashboard } from '../services/marketplace/adminDashboardService';

const REFRESH_MS = 5 * 60 * 1000;

export function useAdminPendingTotal(enabled: boolean): number {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setTotal(0);
      return;
    }

    let active = true;
    const load = () => {
      fetchAdminDashboard()
        .then(data => { if (active) setTotal(data.totalPending); })
        .catch(() => { /* balão é auxiliar: falha não interrompe nada */ });
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') load();
    });

    return () => {
      active = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [enabled]);

  return total;
}
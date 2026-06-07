// ============================================
// useAppSettings — HOOK
//
// Carrega AppSettings com cache de 5 minutos.
// Listener em tempo real — atualiza automaticamente.
//
// Estratégia anti-race-condition:
// - mounted flag evita setState após unmount
// - requestVersion: listener sempre vence cache (> não >=)
// - timeout de 10s garante loading nunca fica infinito
// ============================================

import { useState, useEffect, useRef } from 'react';
import {
  getAppSettings,
  listenToAppSettings,
  DEFAULT_SETTINGS,
} from '../services/marketplace/appSettingsService';
import { AppSettings } from '../shared/types/marketplace';

interface UseAppSettingsReturn {
  settings: AppSettings;
  loading: boolean;
  marketplaceEnabled: boolean;
  maintenanceMode: boolean;
}

export function useAppSettings(): UseAppSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  const listenerVersionRef = useRef(0);
  const cacheVersionRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    const thisCacheVersion = ++cacheVersionRef.current;

    // CORREÇÃO 6: timeout de proteção — loading nunca fica infinito
    const timeout = setTimeout(() => {
      if (!mountedRef.current) return;
      setLoading(false);
    }, 10000);

    // 1. Carrega cache imediatamente
    getAppSettings()
      .then(cached => {
        if (!mountedRef.current) return;
        if (thisCacheVersion > listenerVersionRef.current) {
          setSettings(cached);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setLoading(false);
      });

    // 2. Listener em tempo real — fonte mais confiável
    const unsubscribe = listenToAppSettings(updatedSettings => {
      if (!mountedRef.current) return;
      listenerVersionRef.current++;
      setSettings(updatedSettings);
      setLoading(false);
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  return {
    settings,
    loading,
    marketplaceEnabled: settings.marketplaceEnabled && !settings.maintenanceMode,
    maintenanceMode: settings.maintenanceMode,
  };
}
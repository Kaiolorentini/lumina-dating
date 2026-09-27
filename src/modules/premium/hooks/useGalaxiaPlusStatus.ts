// ============================================
// LUMINA — useGalaxiaPlusStatus
// src/modules/premium/hooks/useGalaxiaPlusStatus.ts
//
// Status da Galáxia Plus para telas que só EXIBEM a oferta
// (loja e pacotes). Recarrega ao ganhar foco — a pessoa pode
// voltar de uma compra — mas no máximo uma vez por minuto:
// abas ficam montadas e cada troca seria uma chamada à CF.
//
// Falha devolve null, sem erro na tela: quem usa este hook
// mostra "Ver detalhes" em vez de um preço. A GalaxiaPlusScreen
// tem estado de erro próprio e não usa este hook.
// ============================================

import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fetchGalaxiaPlusStatus, GalaxiaPlusStatus } from '../services/galaxiaPlusService';

const REFRESH_MS = 60_000;

export function useGalaxiaPlusStatus(): GalaxiaPlusStatus | null {
  const [status, setStatus] = useState<GalaxiaPlusStatus | null>(null);
  const lastFetchRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastFetchRef.current < REFRESH_MS) return;
      lastFetchRef.current = Date.now();

      let cancelled = false;
      fetchGalaxiaPlusStatus()
        .then(result => { if (!cancelled) setStatus(result); })
        .catch(error => {
          console.warn('[useGalaxiaPlusStatus]', error);
          // Libera nova tentativa no próximo foco.
          lastFetchRef.current = 0;
        });
      return () => { cancelled = true; };
    }, []),
  );

  return status;
}
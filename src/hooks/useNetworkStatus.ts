import { useEffect, useState } from 'react';

/**
 * Hook leve de status de rede sem dependências externas.
 * Faz um ping periódico para detectar conectividade e expõe
 * `isOffline` para telas exibirem um banner de estado offline.
 */
export function useNetworkStatus(pingUrl = 'https://www.gstatic.com/generate_204', intervalMs = 8000) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      try {
        await fetch(pingUrl, { method: 'HEAD' });
        if (active) setIsOffline(false);
      } catch {
        if (active) setIsOffline(true);
      } finally {
        if (active) timer = setTimeout(check, intervalMs);
      }
    };

    check();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [pingUrl, intervalMs]);

  return { isOffline };
}

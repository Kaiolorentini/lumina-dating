// ============================================
// LUMINA — RELÓGIO DE VENCIMENTO DE BOOST
// src/hooks/useBoostExpiryTicker.ts
//
// Chama onTick a cada 30 s enquanto `active`, e na hora em que o
// app volta para a frente: com o celular bloqueado o timer do
// JavaScript fica parado, e o boost pode ter vencido nesse tempo.
//
// 30 s é o mesmo intervalo do chip do comprador (useMyActiveBoost):
// quem pagou e quem vê enxergam o fim quase ao mesmo tempo.
// ============================================

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

const BOOST_CHECK_MS = 30 * 1000;

export function useBoostExpiryTicker(active: boolean, onTick: () => void): void {
  // Ref para o intervalo não reiniciar a cada render da tela.
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  useEffect(() => {
    if (!active) return;

    const run = () => tickRef.current();
    const intervalId = setInterval(run, BOOST_CHECK_MS);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') run();
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [active]);
}
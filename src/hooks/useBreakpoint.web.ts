// ============================================
// LUMINA — TAMANHO DE TELA (WEB)
// src/hooks/useBreakpoint.web.ts
//
// Acompanha a janela: redimensionar o navegador troca o layout na
// hora (celular → tablet → computador). Regras em utils/breakpoints.
// ============================================

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { BreakpointInfo, breakpointFor } from '../utils/breakpoints';

export function useBreakpoint(): BreakpointInfo {
  const { width, height } = useWindowDimensions();
  return useMemo(() => breakpointFor(width, height), [width, height]);
}

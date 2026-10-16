// ============================================
// LUMINA — TAMANHO DE TELA (APP ANDROID/iOS)
// src/hooks/useBreakpoint.ts
//
// No app o layout é sempre o de celular, mesmo num tablet Android:
// o app continua exatamente como era. O site usa useBreakpoint.web.ts.
// ============================================

import { useWindowDimensions } from 'react-native';
import { BreakpointInfo } from '../utils/breakpoints';

export function useBreakpoint(): BreakpointInfo {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    layout:    'phone',
    isPhone:   true,
    isTablet:  false,
    isDesktop: false,
    isWide:    false,
  };
}

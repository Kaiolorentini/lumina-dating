// ============================================
// LUMINA — LARGURA DISPONÍVEL PARA A TELA
// src/hooks/useAvailableWidth.ts
//
// 14/10/2026 (web T2). Várias telas calculam colunas e tamanho de
// card pela largura da JANELA (useWindowDimensions). No computador a
// tela não ocupa a janela: fica na coluna central (DesktopScreenFrame)
// ou ao lado do menu lateral (abas). Resultado: card maior que a
// coluna, cortado.
//
// Este hook devolve a largura que a tela REALMENTE tem:
//   • celular, tablet e app: a largura da janela (igual a antes);
//   • computador, dentro da moldura: a largura da coluna;
//   • computador, numa aba: a janela menos o menu lateral.
// ============================================

import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { useBreakpoint } from './useBreakpoint';
import { SIDEBAR_WIDTH } from '../utils/breakpoints';

/** Largura útil da coluna da moldura (null fora dela). */
export const FrameWidthContext = createContext<number | null>(null);

export function useAvailableWidth(): number {
  const { width } = useWindowDimensions();
  const { isDesktop } = useBreakpoint();
  const frameWidth = useContext(FrameWidthContext);
  if (!isDesktop) return width;
  if (frameWidth !== null) return Math.min(frameWidth, width);
  return Math.max(320, width - SIDEBAR_WIDTH);
}

// ============================================
// LUMINA — TAMANHOS DE TELA (RESPONSIVO)
// src/utils/breakpoints.ts
//
// Uma regra só para o site inteiro (13/10/2026, auditoria de
// responsividade). No app (Android/iOS) o useBreakpoint sempre
// responde "celular": nada aqui muda o app.
//
//   celular   < 768 px
//   tablet    768 a 1023 px
//   computador ≥ 1024 px  (menu lateral no lugar das abas)
// ============================================

export const BREAKPOINTS = {
  tablet:  768,
  desktop: 1024,
  wide:    1440,
} as const;

export type LayoutSize = 'phone' | 'tablet' | 'desktop';

export interface BreakpointInfo {
  width:     number;
  height:    number;
  layout:    LayoutSize;
  isPhone:   boolean;
  isTablet:  boolean;
  isDesktop: boolean;
  /** Monitor grande (≥ 1440 px). */
  isWide:    boolean;
}

/** Largura do menu lateral no computador. */
export const SIDEBAR_WIDTH = 232;

/**
 * Largura de referência de celular. Componentes que se medem pela
 * tela (ex.: ProfileCard) usam no máximo isto na web, para não
 * ficarem gigantes num monitor.
 */
export const PHONE_LAYOUT_WIDTH = 430;

/** Largura máxima do conteúdo por tipo de tela (tablet e computador). */
export const CONTENT_MAX_WIDTH = {
  /** Grades e listas de perfis (Home). */
  feed:    1200,
  /** Perfil, configurações, leitura. */
  reading: 820,
  /** Formulários (login, cadastro, suporte, interesses). */
  form:    640,
  /** Painel Admin, tabelas. */
  wide:    1320,
} as const;

export type ContentVariant = keyof typeof CONTENT_MAX_WIDTH;

export function breakpointFor(width: number, height: number): BreakpointInfo {
  const layout: LayoutSize =
    width >= BREAKPOINTS.desktop ? 'desktop'
    : width >= BREAKPOINTS.tablet ? 'tablet'
    : 'phone';
  return {
    width,
    height,
    layout,
    isPhone:   layout === 'phone',
    isTablet:  layout === 'tablet',
    isDesktop: layout === 'desktop',
    isWide:    width >= BREAKPOINTS.wide,
  };
}

/** Colunas da grade de perfis para a largura disponível. */
export function gridColumns(contentWidth: number): number {
  if (contentWidth >= 1100) return 5;
  if (contentWidth >= 860)  return 4;
  if (contentWidth >= 600)  return 3;
  return 2;
}

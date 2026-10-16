// ============================================
// LUMINA — LISTAS EM GRADE NO COMPUTADOR
// src/hooks/useDesktopGrid.tsx
//
// 14/10/2026 (web T3). As listas do admin (pedidos, saques, vendas,
// suporte…) eram uma coluna de cartões de ponta a ponta — num monitor,
// cartões de 1.300 px com três linhas de texto. No computador a mesma
// FlatList passa a mostrar 2 (ou 3) cartões por linha:
//
//   const grid = useDesktopGrid();
//   <FlatList key={grid.listKey} {...grid.listProps} renderItem={grid.wrap(({ item }) => …)} />
// (`key` separado: espalhar key em JSX gera aviso no React 19.)
//
// O renderItem de cada tela não muda: `wrap` só envolve o cartão numa
// célula com a largura da coluna. Celular, tablet e app: 1 coluna, e
// `wrap` devolve o mesmo renderItem (nada muda).
// ============================================

import React from 'react';
import { View, ListRenderItem, ListRenderItemInfo, ViewStyle } from 'react-native';
import { useBreakpoint } from './useBreakpoint';
import { useAvailableWidth } from './useAvailableWidth';

const GAP = 16;
/** Folga do padding das listas (spacing.md dos dois lados). */
const LIST_PADDING = 32;

export interface DesktopGrid {
  columns: number;
  /** Trocar numColumns exige remontar a lista: use como key. */
  listKey: string;
  listProps: {
    numColumns: number;
    columnWrapperStyle?: ViewStyle;
  };
  wrap: <T,>(render: ListRenderItem<T>) => ListRenderItem<T>;
}

/** `minItemWidth`: largura mínima de um cartão para caber mais colunas. */
export function useDesktopGrid(minItemWidth = 440, maxColumns = 3): DesktopGrid {
  const { isDesktop } = useBreakpoint();
  const width = useAvailableWidth();
  const usable = Math.max(0, width - LIST_PADDING);
  const columns = isDesktop
    ? Math.max(1, Math.min(maxColumns, Math.floor((usable + GAP) / (minItemWidth + GAP))))
    : 1;
  const cellWidth = columns > 1 ? Math.floor((usable - GAP * (columns - 1)) / columns) : undefined;

  return {
    columns,
    listKey: `grade-${columns}`,
    listProps: {
      numColumns: columns,
      columnWrapperStyle: columns > 1 ? { gap: GAP } : undefined,
    },
    wrap: <T,>(render: ListRenderItem<T>): ListRenderItem<T> => {
      if (columns === 1) return render;
      return (info: ListRenderItemInfo<T>) => (
        <View style={{ width: cellWidth, minWidth: 0 }}>{render(info)}</View>
      );
    },
  };
}

// ============================================
// LUMINA — LARGURA DO CONTEÚDO
// src/components/layout/PageContainer.tsx
//
// Centraliza e limita a largura do conteúdo no tablet e no
// computador, conforme o tipo de tela (utils/breakpoints:
// feed, reading, form, wide). No celular — e sempre no app — ocupa
// a largura toda, como antes.
//
// Para ScrollView com stickyHeaderIndices, não envolva os filhos:
// use pageContentStyle() no contentContainerStyle, que limita a
// largura sem mudar a ordem dos filhos.
// ============================================

import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { CONTENT_MAX_WIDTH, ContentVariant } from '../../utils/breakpoints';

interface Props {
  variant:  ContentVariant;
  children: React.ReactNode;
  /** Ocupa a altura disponível (telas sem rolagem própria). */
  fill?:    boolean;
  style?:   StyleProp<ViewStyle>;
}

/** Estilo de largura máxima para contentContainerStyle de ScrollView. */
export function pageContentStyle(variant: ContentVariant, isPhone: boolean): ViewStyle | null {
  if (isPhone) return null;
  return { width: '100%', maxWidth: CONTENT_MAX_WIDTH[variant], alignSelf: 'center' };
}

export default function PageContainer({ variant, children, fill = false, style }: Props) {
  const { isPhone } = useBreakpoint();
  return (
    <View style={[styles.base, fill && styles.fill, pageContentStyle(variant, isPhone), style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { width: '100%' },
  fill: { flex: 1 },
});

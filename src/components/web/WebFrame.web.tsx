// ============================================
// LUMINA — MOLDURA (WEB)
// src/components/web/WebFrame.web.tsx
//
// No PC o app fica numa coluna central (largura de celular grande),
// em vez de esticado ou em "meia tela". No navegador do celular a
// coluna ocupa a tela toda. overflow hidden recorta telas que ainda
// calculam a largura pela janela inteira (Dimensions.get — lote 3).
// ============================================

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme';
import { WEB_FRAME_MAX_WIDTH } from '../../utils/layout';

interface Props { children: React.ReactNode }

export default function WebFrame({ children }: Props) {
  return (
    <View style={styles.outer}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1, alignItems: 'center', backgroundColor: '#000000',
  },
  column: {
    flex: 1, width: '100%', maxWidth: WEB_FRAME_MAX_WIDTH,
    overflow: 'hidden', backgroundColor: colors.background,
    borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gold + '33',
  },
});
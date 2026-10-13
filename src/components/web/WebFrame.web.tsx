// ============================================
// LUMINA — MOLDURA (WEB)
// src/components/web/WebFrame.web.tsx
//
// 13/10/2026: volta a ocupar a tela cheia (decisão de Kaio — a
// coluna central de 480 px não organizava as telas para o PC).
// Este componente fica como o ponto onde entra o layout de
// computador da auditoria de responsividade (menu lateral,
// larguras por tipo de tela).
// ============================================

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme';

interface Props { children: React.ReactNode }

export default function WebFrame({ children }: Props) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
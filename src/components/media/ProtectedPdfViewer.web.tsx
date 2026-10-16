// ============================================
// LUMINA — LEITOR DE PDF PROTEGIDO (WEB)
// src/components/media/ProtectedPdfViewer.web.tsx
//
// Versão do navegador. O Metro escolhe este arquivo só na web;
// o Android continua com ProtectedPdfViewer.tsx (react-native-pdf),
// que não roda no navegador.
//
// Ainda não existe leitor protegido para a web (decisão pendente:
// páginas em imagem com marca d'água no servidor × pdf.js). Até lá,
// esta tela explica ao comprador onde ler o conteúdo e NÃO usa o link
// do PDF: o arquivo não é baixado nem fica exposto no navegador.
//
// Mesmas props do arquivo nativo, para o ContentViewerScreen não mudar.
// ============================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../theme';

interface Props {
  uri:        string;
  watermark:  string;
  refreshUrl: () => Promise<string>;
}

export default function ProtectedPdfViewer(_props: Props) {
  return (
    <View style={styles.center}>
      <View style={styles.card} accessibilityRole="summary">
        <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">📄</Text>
        <Text style={styles.title}>Leitura de PDF no navegador em breve</Text>
        <Text style={styles.text}>
          Sua compra está garantida e continua disponível na sua conta.
        </Text>
        <Text style={styles.text}>
          Por enquanto, para proteger o conteúdo do criador, os PDFs só podem ser
          lidos pelo app Lumina no Android.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.lg, backgroundColor: colors.background,
  },
  card: {
    width: '100%', maxWidth: 420, alignItems: 'center', gap: spacing.sm,
    padding: spacing.lg, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gold + '55',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  icon:  { fontSize: 40 },
  title: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold', textAlign: 'center' },
  text:  { color: colors.white, fontSize: fonts.sizes.md, textAlign: 'center', lineHeight: 22 },
});
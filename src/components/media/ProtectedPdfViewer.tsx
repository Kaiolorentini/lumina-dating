// ============================================
// LUMINA — LEITOR DE PDF PROTEGIDO
// src/components/media/ProtectedPdfViewer.tsx
//
// Desenha as páginas dentro do app (react-native-pdf), na mesma tela
// com bloqueio de captura e marca d'água móvel. cache: false — o PDF
// não fica guardado no aparelho.
//
// O PDF é baixado de uma vez ao abrir: o link vencer depois não
// interrompe a leitura. Falha ao abrir → um link novo, até 2 vezes.
// ============================================

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import Pdf from 'react-native-pdf';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import MovingWatermark from './MovingWatermark';

const MAX_RETRIES = 2;

interface Props {
  uri:        string;
  watermark:  string;
  refreshUrl: () => Promise<string>;
}

export default function ProtectedPdfViewer({ uri, watermark, refreshUrl }: Props) {
  const { width } = useWindowDimensions();
  const [source, setSource]   = useState(uri);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [retries, setRetries] = useState(0);

  const recover = useCallback(async () => {
    if (retries >= MAX_RETRIES) {
      setError(true);
      setLoading(false);
      return;
    }
    setRetries(r => r + 1);
    setLoading(true);
    try {
      setSource(await refreshUrl());
    } catch {
      setError(true);
      setLoading(false);
    }
  }, [retries, refreshUrl]);

  function retry() {
    setRetries(0);
    setError(false);
    setLoading(true);
    refreshUrl().then(setSource).catch(() => { setError(true); setLoading(false); });
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Não foi possível abrir o PDF.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={retry} accessibilityRole="button">
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Pdf
        key={source}
        source={{ uri: source, cache: false }}
        style={[styles.pdf, { width }]}
        trustAllCerts={false}
        enableAntialiasing
        onLoadComplete={pages => { setTotal(pages); setLoading(false); }}
        onPageChanged={current => setPage(current)}
        onError={() => { recover(); }}
      />

      <MovingWatermark text={watermark} />

      {loading && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Abrindo o PDF...</Text>
        </View>
      )}

      {total > 0 && (
        <View style={styles.pageBadge} pointerEvents="none">
          <Text style={styles.pageText}>Página {page} de {total}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { flex: 1 },
  pdf:    { flex: 1, backgroundColor: colors.background },
  center: {
    ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, padding: spacing.lg,
  },
  loadingText: { color: colors.gray, fontSize: fonts.sizes.md },
  errorIcon:   { fontSize: 40 },
  errorText:   { color: colors.white, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn:    { backgroundColor: colors.gold, borderRadius: borderRadius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  retryText:   { color: colors.background, fontWeight: 'bold' },
  pageBadge: {
    position: 'absolute', bottom: spacing.lg, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderWidth: 1, borderColor: colors.gold + '55',
  },
  pageText: { color: colors.white, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
});
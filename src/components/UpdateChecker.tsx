import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import * as Updates from 'expo-updates';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, alpha } from '../theme/tokens';
import { Button } from './ui/Button';

/**
 * UpdateChecker — Integração real com EAS Update (expo-updates).
 *
 * Fluxo:
 *  1. No mount, verifica se há update OTA (checkForUpdateAsync).
 *  2. Se houver, baixa em segundo plano (fetchUpdateAsync) sem bloquear o app.
 *  3. Mostra um banner discreto "Atualização pronta — toque para aplicar".
 *  4. Ao tocar, recarrega o bundle (reloadAsync).
 *
 * Em dev (expo start / dev-client) o expo-updates é no-op, então o fluxo
 * de teste visual é feito pelo botão manual abaixo.
 */
export default function UpdateChecker() {
  const [checking, setChecking] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const isEmbedded = Updates.isEmbeddedLaunch || !Updates.createdAt;
  const isDevClient = __DEV__ && Updates.isEmbeddedLaunch;

  const checkAndFetch = async () => {
    setChecking(true);
    setLastError(null);
    setStatus('Verificando...');
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setStatus('Update disponível — baixando...');
        await Updates.fetchUpdateAsync();
        setUpdateReady(true);
        setStatus(isDevClient
          ? 'Update baixado (dev-client não recarrega OTA — use build de preview/produção)'
          : 'Update pronto — reinicie o app');
      } else {
        setStatus('Nenhum update disponível');
      }
    } catch (e: any) {
      setLastError(e?.message ?? 'Falha ao verificar atualização');
      setStatus('Erro na verificação');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // Verificação automática só em build release (não dev).
    if (!__DEV__) {
      checkAndFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyUpdate() {
    try {
      await Updates.reloadAsync();
    } catch (e: any) {
      setLastError(e?.message ?? 'Falha ao aplicar atualização');
    }
  }

  async function openStore() {
    const url =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/id...'
        : 'https://play.google.com/store/apps/details?id=com.lumina.dating';
    try {
      await Linking.openURL(url);
    } catch {
      /* noop */
    }
  }

  return (
    <>
      {updateReady && (
        <View style={styles.banner} accessibilityRole="alert">
          <View style={styles.bannerContent}>
            <Text style={styles.bannerIcon}>🔄</Text>
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerTitle}>Atualização pronta</Text>
              <Text style={styles.bannerSub}>Toque para aplicar as melhorias</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.bannerButton} onPress={applyUpdate} accessibilityRole="button" accessibilityLabel="Aplicar atualização">
            <Text style={styles.bannerButtonText}>Reiniciar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Painel de teste visual / QA — útil para validar OTA sem subir build */}
      {__DEV__ && (
        <View style={styles.qaPanel} accessibilityRole="alert">
          <Text style={styles.qaTitle}>🔧 Teste OTA (dev)</Text>
          <Text style={styles.qaMeta}>
            {isEmbedded ? 'Launch: embedded' : 'Launch: OTA'} · runtime {Updates.runtimeVersion ?? 'n/a'}
          </Text>
          {status ? <Text style={styles.qaStatus}>{status}</Text> : null}
          {lastError && <Text style={styles.qaError}>{lastError}</Text>}
          {updateReady && (
            <Button label="Recarregar OTA" variant="success" size="sm" onPress={applyUpdate} />
          )}
          <View style={styles.qaButtons}>
            <Button label="Verificar OTA" variant="secondary" size="sm" loading={checking} onPress={checkAndFetch} />
            <Button label="Abrir loja" variant="ghost" size="sm" onPress={openStore} />
          </View>
          <Text style={styles.qaHint}>
            {isDevClient
              ? 'Dev-client não aplica OTA automaticamente. Instale o build de preview/produção para receber o update de verdade.'
              : 'Em produção, updates baixam automático e mostram banner.'}
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: COLORS.gold,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.lg,
  },
  bannerContent: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  bannerIcon: { fontSize: 20 },
  bannerTextWrap: { flex: 1 },
  bannerTitle: { color: COLORS.background, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  bannerSub: { color: COLORS.background, fontSize: FONT_SIZE.xs, opacity: 0.85 },
  bannerButton: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  bannerButtonText: { color: COLORS.gold, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },

  qaPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    backgroundColor: alpha(COLORS.card, 0.96),
    borderTopWidth: 1,
    borderTopColor: alpha(COLORS.gold, 0.27),
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  qaTitle: { color: COLORS.gold, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  qaMeta: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  qaStatus: { color: COLORS.gold, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },
  qaError: { color: COLORS.error, fontSize: FONT_SIZE.xs },
  qaButtons: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  qaHint: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
});

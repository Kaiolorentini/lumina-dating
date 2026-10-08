// ============================================
// LUMINA — REPRODUTOR DE VÍDEO PROTEGIDO
// src/components/media/ProtectedVideoPlayer.tsx
//
// expo-video (o expo-av foi descontinuado no SDK 54).
//
// - Link vencido no meio: busca um novo e CONTINUA do mesmo segundo
//   (até 3 tentativas seguidas), sem a pessoa perceber.
// - Sem picture-in-picture e sem a tela cheia nativa: as duas abrem
//   janelas fora da marca d'água e, no Android, fora do bloqueio de
//   captura. A tela cheia é do próprio app, girada para a horizontal.
// - Pausa quando o app vai para segundo plano.
// - O player é liberado ao sair da tela (useVideoPlayer cuida disso).
// ============================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet,
  AppState, StatusBar, LayoutChangeEvent,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import MovingWatermark from './MovingWatermark';

const MAX_RETRIES = 3;

interface Props {
  uri:        string;
  watermark:  string;
  /** Busca um link novo para o MESMO arquivo. */
  refreshUrl: () => Promise<string>;
  onFullscreenChange?: (fullscreen: boolean) => void;
}

type Status = 'loading' | 'ready' | 'error';

export default function ProtectedVideoPlayer({ uri, watermark, refreshUrl, onFullscreenChange }: Props) {
  const player = useVideoPlayer({ uri }, p => {
    p.loop = false;
    p.timeUpdateEventInterval = 1;
    p.play();
  });

  const [status, setStatus]         = useState<Status>('loading');
  const [fullscreen, setFullscreen] = useState(false);
  const [rotated, setRotated]       = useState(true);
  const [box, setBox]               = useState({ width: 0, height: 0 });

  const lastTime   = useRef(0);
  const retries    = useRef(0);
  const recovering = useRef(false);

  // Link vencido ou falha de rede: link novo, mesmo segundo.
  const recover = useCallback(async () => {
    if (recovering.current) return;
    if (retries.current >= MAX_RETRIES) {
      setStatus('error');
      return;
    }
    recovering.current = true;
    retries.current += 1;
    setStatus('loading');
    try {
      const fresh = await refreshUrl();
      await player.replaceAsync({ uri: fresh });
      player.currentTime = lastTime.current;
      player.play();
    } catch {
      setStatus('error');
    } finally {
      recovering.current = false;
    }
  }, [player, refreshUrl]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (currentTime > 0) lastTime.current = currentTime;
  });

  useEventListener(player, 'statusChange', ({ status: next }) => {
    if (next === 'readyToPlay') {
      setStatus('ready');
      retries.current = 0;
    } else if (next === 'error') {
      recover();
    }
  });

  // Segundo plano: pausa (proteção e bateria).
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') player.pause();
    });
    return () => sub.remove();
  }, [player]);

  function toggleFullscreen(on: boolean) {
    setFullscreen(on);
    onFullscreenChange?.(on);
  }

  function retry() {
    retries.current = 0;
    recover();
  }

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setBox({ width, height });
  }

  const overlay = (
    <>
      <MovingWatermark text={watermark} />
      {status === 'loading' && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      )}
      {status === 'error' && (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>Não foi possível reproduzir o vídeo.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retry} accessibilityRole="button">
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const video = (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls
      contentFit="contain"
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  );

  // Tela cheia do app: ocupa a tela toda e gira o vídeo para a
  // horizontal. SEM Modal — no Android, a janela do Modal ficaria fora
  // do bloqueio de captura.
  if (fullscreen) {
    const w = rotated ? box.height : box.width;
    const h = rotated ? box.width : box.height;
    return (
      <View style={styles.fullscreen} onLayout={onLayout}>
        <StatusBar hidden />
        {box.width > 0 && (
          <View style={{ width: w, height: h, transform: rotated ? [{ rotate: '90deg' }] : [] }}>
            {video}
            {overlay}
          </View>
        )}
        <View style={styles.fsBar}>
          <TouchableOpacity style={styles.fsBtn} onPress={() => setRotated(r => !r)} accessibilityRole="button" accessibilityLabel="Girar vídeo">
            <Text style={styles.fsBtnText}>⟳ Girar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fsBtn} onPress={() => toggleFullscreen(false)} accessibilityRole="button" accessibilityLabel="Sair da tela cheia">
            <Text style={styles.fsBtnText}>✕ Sair</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.inlineWrap}>
      <View style={styles.inline}>
        {video}
        {overlay}
      </View>
      <TouchableOpacity
        style={styles.expandBtn}
        onPress={() => toggleFullscreen(true)}
        accessibilityRole="button"
        accessibilityLabel="Tela cheia"
      >
        <Text style={styles.expandText}>⛶ Tela cheia</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineWrap: { width: '100%', alignItems: 'center', gap: spacing.md },
  inline:     { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000000' },
  fullscreen: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  center: {
    ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, padding: spacing.lg,
  },
  errorIcon:  { fontSize: 40 },
  errorText:  { color: colors.white, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn:   { backgroundColor: colors.gold, borderRadius: borderRadius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  retryText:  { color: colors.background, fontWeight: 'bold' },
  expandBtn:  { borderWidth: 1, borderColor: colors.gold, borderRadius: borderRadius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  expandText: { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  fsBar:      { position: 'absolute', top: spacing.lg, right: spacing.md, flexDirection: 'row', gap: spacing.sm },
  fsBtn:      { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.gold + '88' },
  fsBtnText:  { color: colors.white, fontWeight: 'bold', fontSize: fonts.sizes.sm },
});
// ============================================
// LUMINA — VISITS BANNER v2.0
// src/components/VisitsBanner.tsx
//
// v2.0:
// - Aparece também quando há visitas TOTAIS mas nenhuma hoje.
//   Antes retornava null com todayVisits === 0 e o produto
//   "Ver Visitantes" ficava invisível para quem tem histórico.
// - Animação com cleanup e pausa fora de foco. O Animated.loop
//   anterior nunca parava: rodava enquanto a Home estivesse
//   montada, mesmo com o app em outra aba.
// - Sub-texto reflete o estado real (revelado vs. bloqueado)
//   em vez de prometer "toque para ver quem visitou" sempre.
// ============================================

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  AccessibilityInfo,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { colors, fonts, spacing, borderRadius } from '../theme';

interface Props {
  visitasHoje:  number;
  totalVisitas?: number;
  /** Acesso à lista já liberado (24h ativas). */
  hasAccess?:   boolean;
  onPress?:     () => void;
}

export default function VisitsBanner({
  visitasHoje,
  totalVisitas = 0,
  hasAccess = false,
  onPress,
}: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loopRef   = useRef<Animated.CompositeAnimation | null>(null);
  const isFocused = useIsFocused();

  const temVisitasHoje = visitasHoje > 0;
  const temHistorico   = totalVisitas > 0;
  const visivel        = temVisitasHoje || temHistorico;

  // Pulsa só com visitas de hoje, só com a tela em foco, e para
  // de verdade no unmount. Respeita "reduzir movimento".
  useEffect(() => {
    let cancelled = false;

    function stop() {
      loopRef.current?.stop();
      loopRef.current = null;
      pulseAnim.setValue(1);
    }

    if (!temVisitasHoje || !isFocused) {
      stop();
      return;
    }

    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduceMotion => {
        if (cancelled || reduceMotion) return;

        loopRef.current = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.03,
              duration: 1000,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        );
        loopRef.current.start();
      })
      .catch(() => { /* preferência indisponível: segue sem animar */ });

    return () => {
      cancelled = true;
      stop();
    };
  }, [temVisitasHoje, isFocused, pulseAnim]);

  if (!visivel) return null;

  function getMessage(): string {
    if (visitasHoje === 1)  return 'Alguém visitou seu perfil hoje';
    if (visitasHoje >= 10)  return `${visitasHoje} visitas hoje — perfil bombando!`;
    if (visitasHoje >= 5)   return `${visitasHoje} visitas hoje — você está em alta!`;
    if (visitasHoje > 1)    return `${visitasHoje} pessoas visitaram seu perfil hoje`;
    // Sem visitas hoje, mas com histórico
    if (totalVisitas === 1) return '1 pessoa já visitou seu perfil';
    return `${totalVisitas} pessoas já visitaram seu perfil`;
  }

  function getSub(): string {
    if (hasAccess)     return 'Toque para ver quem visitou';
    if (temVisitasHoje) return 'Descubra quem foi';
    return 'Veja quem passou por aqui';
  }

  function getIcon(): string {
    if (visitasHoje >= 10) return '🔥';
    if (visitasHoje >= 5)  return '⚡';
    if (temVisitasHoje)    return '👀';
    return '✨';
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      <TouchableOpacity
        style={styles.inner}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${getMessage()}. ${getSub()}`}
      >
        <Text style={styles.icon} allowFontScaling={false}>{getIcon()}</Text>
        <View style={styles.content}>
          <Text style={styles.message} numberOfLines={2}>{getMessage()}</Text>
          <Text style={styles.sub} numberOfLines={1}>{getSub()}</Text>
        </View>
        {hasAccess && (
          <View style={styles.activePill}>
            <Text style={styles.activePillText}>ATIVO</Text>
          </View>
        )}
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  icon:    { fontSize: 28 },
  content: { flex: 1 },
  message: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  sub:     { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: 2 },
  activePill: {
    backgroundColor: colors.success + '22',
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  activePillText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  arrow: { color: colors.gold, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
});
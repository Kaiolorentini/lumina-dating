// ============================================
// LUMINA — BOOST BADGE v2.0
// src/components/BoostBadge.tsx
//
// v2.0 (27/09) — TRÊS SELOS, UM ESTILO.
// Um selo por impulso, com a escada visível sem precisar ler:
//   Impulso  — lilás, seta,  "IMPULSIONADO", estático
//   Turbo    — DOURADO, raio, "TURBO", anel pulsando (topo)
//   Destaque — platina, pino, "EM DESTAQUE", estático
//
// Ícones em VETOR (sem emoji) e borda em degradê: é um selo
// pago, precisa parecer produto, não enfeite.
//
// POSIÇÃO: canto INFERIOR esquerdo da foto, igual na grade, no
// Sintonize e no Em Alta. Os cantos de cima já têm título,
// Sintonia, ranking e visitas — na v1 o selo disputava o canto
// com o título e os dois se sobrepunham. Quem posiciona é o card
// (top/left), porque só ele sabe a altura da foto.
//
// CDC Art. 36 — posição PAGA identificável: texto do selo e
// accessibilityLabel ("Posição paga"). NUNCA remover.
//
// PERFORMANCE (mantida da v1): UM Animated.Value no módulo,
// compartilhado por todos os selos que pulsam; só opacity com
// native driver; para quando o último sai de tela, quando a tela
// perde foco ou com "reduzir movimento" ligado. React.memo.
// ============================================

import React, { memo, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing,
  AccessibilityInfo, StyleProp, ViewStyle,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { SPACING, BORDER_RADIUS } from '../theme/tokens';

export type BoostType = 'impulso' | 'turbo' | 'destaque';

/** Altura total do selo — o card usa para encostá-lo na base da foto. */
export const BOOST_BADGE_HEIGHT = 22;

export const BOOST_STYLE: Record<BoostType, {
  label:  string;
  color:  string;
  border: [string, string];
  pulse:  boolean;
  a11y:   string;
}> = {
  impulso: {
    label:  'IMPULSIONADO',
    color:  '#C9A4F2',
    border: ['#8E5BD6', '#C9A4F2'],
    pulse:  false,
    a11y:   'Perfil impulsionado. Posição paga.',
  },
  turbo: {
    label:  'TURBO',
    color:  '#F0D060',
    border: ['#B8902A', '#F6E08A'],
    pulse:  true,
    a11y:   'Perfil impulsionado com Turbo. Posição paga.',
  },
  destaque: {
    label:  'EM DESTAQUE',
    color:  '#DDE6EF',
    border: ['#8FA3B8', '#EEF3F8'],
    pulse:  false,
    a11y:   'Perfil em destaque na sua região. Posição paga.',
  },
};

/** Ícone vetorial do impulso. Exportado para o chip da Home. */
export function BoostIcon({ type, color, size = 11 }: { type: BoostType; color: string; size?: number }) {
  if (type === 'turbo') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill={color} />
      </Svg>
    );
  }
  if (type === 'destaque') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"
          fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round"
        />
        <Circle cx={12} cy={10} r={2.6} fill={color} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 19V5M5 12l7-7 7 7"
        fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Pulso compartilhado (só o Turbo pulsa) ──

const PULSE_HALF_CYCLE_MS = 1100;

let sharedPulse: Animated.Value | null = null;
let sharedLoop: Animated.CompositeAnimation | null = null;
let subscriberCount = 0;

function getSharedPulse(): Animated.Value {
  if (!sharedPulse) sharedPulse = new Animated.Value(0);
  return sharedPulse;
}

function subscribeToPulse(): void {
  subscriberCount += 1;
  if (subscriberCount > 1) return;

  const value = getSharedPulse();
  value.setValue(0);

  sharedLoop = Animated.loop(
    Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: PULSE_HALF_CYCLE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: PULSE_HALF_CYCLE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]),
  );
  sharedLoop.start();
}

function unsubscribeFromPulse(): void {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount > 0) return;
  if (sharedLoop) {
    sharedLoop.stop();
    sharedLoop = null;
  }
  getSharedPulse().setValue(0);
}

interface BoostBadgeProps {
  type:      BoostType;
  /** Offset a partir do topo do card — o card calcula a base da foto. */
  top?:      number;
  left?:     number;
  /** Desliga o pulso explicitamente. */
  animated?: boolean;
  style?:    StyleProp<ViewStyle>;
}

function BoostBadgeBase({
  type, top = SPACING.sm, left = SPACING.sm, animated = true, style,
}: BoostBadgeProps) {
  const variant   = BOOST_STYLE[type];
  const isFocused = useIsFocused();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => { if (mounted) setReduceMotion(enabled); })
      .catch(() => { if (mounted) setReduceMotion(false); });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => { if (mounted) setReduceMotion(enabled); },
    );
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  const shouldAnimate = variant.pulse && animated && isFocused && !reduceMotion;

  const subscribedRef = useRef(false);
  useEffect(() => {
    if (shouldAnimate && !subscribedRef.current) {
      subscribeToPulse();
      subscribedRef.current = true;
    } else if (!shouldAnimate && subscribedRef.current) {
      unsubscribeFromPulse();
      subscribedRef.current = false;
    }
  }, [shouldAnimate]);

  useEffect(() => () => {
    if (subscribedRef.current) {
      unsubscribeFromPulse();
      subscribedRef.current = false;
    }
  }, []);

  const ringOpacity = shouldAnimate
    ? getSharedPulse().interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.8] })
    : 0;

  return (
    <View
      style={[styles.wrapper, { top, left }, style]}
      pointerEvents="none"
      accessible
      accessibilityRole="text"
      accessibilityLabel={variant.a11y}
    >
      {variant.pulse && (
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { borderColor: variant.color, opacity: ringOpacity }]}
        />
      )}

      <LinearGradient
        colors={variant.border}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.border}
      >
        <View style={styles.pill}>
          <BoostIcon type={type} color={variant.color} />
          <Text
            style={[styles.label, { color: variant.color }]}
            allowFontScaling={false}
            numberOfLines={1}
          >
            {variant.label}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', zIndex: 10 },
  ring: {
    position: 'absolute',
    top: -3, left: -3, right: -3, bottom: -3,
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.full,
  },
  border: {
    borderRadius: BORDER_RADIUS.full,
    padding: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: BOOST_BADGE_HEIGHT - 2,
    paddingHorizontal: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(10, 10, 20, 0.84)',
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

export default memo(BoostBadgeBase);
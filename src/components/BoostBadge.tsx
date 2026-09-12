// ============================================
// LUMINA — BOOST BADGE v1.0
// src/components/BoostBadge.tsx
//
// Variante A: pill posicionado sobre a foto do card.
// Usado APENAS na Home (ProfileCard), conforme decisão de escopo.
//
// REGRA DE NEGÓCIO:
// Turbo e Destaque Regional são MUTUAMENTE EXCLUSIVOS.
// A garantia é do backend (transaction nas CFs de ativação).
// Este componente recebe um único `type` — nunca renderiza dois.
//
// CDC Art. 36 — Destaque Regional é espaço PAGO e precisa ser
// identificável. O label "Em Destaque" + accessibilityLabel
// cumprem a identificação. NUNCA remover.
//
// PERFORMANCE (FlatList com dezenas de cards):
// 1. UM ÚNICO Animated.Value no escopo do módulo, compartilhado
//    por todos os badges em tela. N badges = 1 loop, não N loops.
// 2. Anima só `opacity` com useNativeDriver: true — roda na thread
//    de UI, não na JS thread. `borderColor` NÃO é native-drivable;
//    por isso o pulso é um anel sobreposto, não a borda do pill.
// 3. Contador de assinantes: o loop para sozinho quando o último
//    badge sai de tela.
// 4. useIsFocused: loop pausa quando a Home perde foco (economia
//    de bateria em tab navigator, onde a tela fica montada).
// 5. AccessibilityInfo.isReduceMotionEnabled: respeita "reduzir
//    movimento" do sistema e cai para estado estático.
// 6. React.memo: sem re-render em scroll.
// ============================================

import React, { memo, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  AccessibilityInfo,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../theme/tokens';

// --------------------------------------------
// Tipos
// --------------------------------------------

export type BoostType = 'turbo' | 'destaque';

interface BoostBadgeProps {
  /** Tipo de boost ativo. Nunca dois ao mesmo tempo. */
  type: BoostType;
  /** Offset a partir do topo da foto. */
  top?: number;
  /** Offset a partir da esquerda da foto. */
  left?: number;
  /** Desliga o pulso explicitamente (ex.: listas muito longas). */
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
}

// --------------------------------------------
// Variantes visuais
// --------------------------------------------

const VARIANTS: Record<
  BoostType,
  { label: string; icon: string; bg: string; ring: string; border: string; text: string; a11y: string }
> = {
  turbo: {
    label: 'Turbo',
    icon: '⚡',
    bg: 'rgba(13, 13, 26, 0.82)',
    ring: '#F0D060',
    border: '#D4AF37',
    text: '#F0D060',
    a11y: 'Perfil com Turbo Sintonia ativo',
  },
  destaque: {
    label: 'Em Destaque',
    icon: '💎',
    bg: 'rgba(13, 13, 26, 0.82)',
    ring: '#E8E8E8',
    border: '#C0C0C0',
    text: '#E8E8E8',
    // CDC Art. 36 — identificação de espaço pago.
    a11y: 'Perfil em destaque. Este usuário adquiriu um Destaque na sua região.',
  },
};

// --------------------------------------------
// Driver de animação COMPARTILHADO
//
// Escopo de módulo de propósito: um único Animated.Value
// alimenta todos os badges montados. Trocar isso por um
// useRef(new Animated.Value(0)) por instância recria o
// problema de N loops concorrentes em aparelhos fracos.
// --------------------------------------------

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
      Animated.timing(value, {
        toValue: 1,
        duration: PULSE_HALF_CYCLE_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 0,
        duration: PULSE_HALF_CYCLE_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
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

// --------------------------------------------
// Componente
// --------------------------------------------

function BoostBadgeBase({
  type,
  top = SPACING.sm,
  left = SPACING.sm,
  animated = true,
  style,
}: BoostBadgeProps) {
  const variant = VARIANTS[type];
  const isFocused = useIsFocused();
  const [reduceMotion, setReduceMotion] = useState(false);

  // Preferência de acessibilidade do sistema.
  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        // Falha na leitura da preferência não deve quebrar o card.
        if (mounted) setReduceMotion(false);
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => {
        if (mounted) setReduceMotion(enabled);
      },
    );

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  const shouldAnimate = animated && isFocused && !reduceMotion;

  // Assina/desassina o loop compartilhado.
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

  // Garante liberação no unmount (scroll rápido, troca de aba).
  useEffect(() => {
    return () => {
      if (subscribedRef.current) {
        unsubscribeFromPulse();
        subscribedRef.current = false;
      }
    };
  }, []);

  const ringOpacity = shouldAnimate
    ? getSharedPulse().interpolate({
        inputRange: [0, 1],
        outputRange: [0.2, 0.85],
      })
    : 0.5;

  return (
    <View
      style={[styles.wrapper, { top, left }, style]}
      pointerEvents="none"
      accessible
      accessibilityRole="text"
      accessibilityLabel={variant.a11y}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          { borderColor: variant.ring, opacity: ringOpacity },
        ]}
      />

      <View
        style={[
          styles.pill,
          {
            backgroundColor: variant.bg,
            borderColor: variant.border,
          },
        ]}
      >
        <Text style={styles.icon} allowFontScaling={false}>
          {variant.icon}
        </Text>
        <Text
          style={[styles.label, { color: variant.text }]}
          allowFontScaling={false}
          numberOfLines={1}
        >
          {variant.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 10,
  },
  ring: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  icon: {
    fontSize: FONT_SIZE.sm,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.3,
  },
});

export default memo(BoostBadgeBase);
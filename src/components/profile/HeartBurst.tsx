// ============================================
// LUMINA — CORAÇÕES DA SINTONIA
// src/components/profile/HeartBurst.tsx
//
// Comemoração da curtida no Sintonize. Sem isto, o toque no
// botão mudava um texto pequeno no card e mais nada — parecia
// que não tinha funcionado.
//
// Seis corações subindo com tempos, desvios e tamanhos
// diferentes. Iguais leem como animação de sistema; desiguais
// leem como comemoração.
//
// Uma animação só para todos, com o atraso vindo da
// interpolação de cada um — em vez de seis Animated.Value.
// ============================================

import React, { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Animated, Easing, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface Props {
  /** Vira true no momento da curtida. */
  active: boolean;
  width:  number;
  height: number;
  onDone?: () => void;
}

const COUNT = 6;
const DURATION = 1800;

export function HeartBurst({ active, width, height, onDone }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  const hearts = useMemo(
    () =>
      Array.from({ length: COUNT }).map((_, i) => ({
        // Espalhados na largura, com desvio para não subirem
        // em coluna.
        x:     width * (0.2 + (i / COUNT) * 0.6),
        drift: ((i % 2 === 0) ? 1 : -1) * (12 + (i % 3) * 14),
        size:  18 + (i % 3) * 9,
        // O atraso é o que faz parecer um jorro e não um
        // pelotão.
        delay: (i / COUNT) * 0.35,
      })),
    [width],
  );

  useEffect(() => {
    if (!active) {
      progress.setValue(0);
      return;
    }

    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => onDone?.());
  }, [active]);

  if (!active) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {hearts.map((h, i) => {
        // Cada coração tem a própria janela dentro da animação
        // compartilhada: começa no delay e termina antes do fim.
        const start = h.delay;
        const end   = Math.min(1, start + 0.72);

        const translateY = progress.interpolate({
          inputRange:  [0, start, end, 1],
          outputRange: [0, 0, -height * 0.9, -height * 0.9],
        });
        const translateX = progress.interpolate({
          inputRange:  [0, start, end, 1],
          outputRange: [0, 0, h.drift, h.drift],
        });
        const opacity = progress.interpolate({
          inputRange:  [0, start, start + 0.08, end - 0.2, end, 1],
          outputRange: [0, 0, 1, 1, 0, 0],
        });
        const scale = progress.interpolate({
          inputRange:  [0, start, start + 0.15, end, 1],
          outputRange: [0.4, 0.4, 1.15, 0.85, 0.85],
        });

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: h.x - h.size / 2,
              // Nascem logo acima do rodapé, não no meio da
              // tela: a curtida acontece embaixo, e a
              // comemoração tem que vir de onde a mão está.
              bottom: 70,
              opacity,
              transform: [{ translateX }, { translateY }, { scale }],
            }}
          >
            <Svg width={h.size} height={h.size} viewBox="0 0 24 24">
              <Path
                d="M 12 21 C 12 21 2.5 14.6 2.5 8.6 C 2.5 5.5 4.9 3 8 3 C 9.7 3 11.2 3.8 12 5.1 C 12.8 3.8 14.3 3 16 3 C 19.1 3 21.5 5.5 21.5 8.6 C 21.5 14.6 12 21 12 21 Z"
                fill="#E91E63"
              />
              {/* Reflexo: sem ele o coração fica chapado. */}
              <Path
                d="M 7.4 6 C 6.2 6.5 5.4 7.6 5.4 8.9 C 5.4 9.4 6.2 9.4 6.3 8.9 C 6.4 7.8 6.9 7 7.7 6.7 C 8.2 6.5 7.9 5.8 7.4 6 Z"
                fill="#FFFFFF"
                opacity={0.6}
              />
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}
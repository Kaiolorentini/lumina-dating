// ============================================
// LUMINA — FUNDO DA CARTA DO DESTINO
// src/modules/engagement/components/DestinyBackground.tsx
//
// Diferente do fundo do Sintonize, que é um campo aberto de
// estrelas: aqui o céu CONVERGE para o centro, onde a carta
// está. É a composição dizendo que aquele ponto é o que
// importa.
//
// Três camadas: nebulosa dourada ao centro, estrelas em
// densidade maior nas bordas, e linhas de convergência muito
// sutis apontando para o meio.
//
// Uma animação só, de respiração no brilho central — a carta
// já tem a virada, e um fundo agitado competiria com ela.
// ============================================

import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, Animated, Easing, Dimensions, View } from 'react-native';
import Svg, {
  Circle, Defs, RadialGradient, Stop, Ellipse, Rect, Line,
} from 'react-native-svg';
import { colors } from '../../../theme';

const { width, height } = Dimensions.get('window');

const STAR_COUNT = 140;

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
}

export function DestinyBackground() {
  const pulse = useRef(new Animated.Value(0)).current;

  // Sorteadas uma vez. A densidade cresce com a distância do
  // centro: o miolo fica limpo para a carta, e as bordas dão
  // a sensação de profundidade.
  const stars = useMemo<Star[]>(() => {
    const list: Star[] = [];
    const cx = width / 2;
    const cy = height / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);

    let tries = 0;
    while (list.length < STAR_COUNT && tries < STAR_COUNT * 6) {
      tries++;
      const x = Math.random() * width;
      const y = Math.random() * height;

      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
      // Perto do centro, a chance de aceitar é baixa.
      if (Math.random() > dist * 1.15) continue;

      list.push({
        x, y,
        r: Math.random() < 0.75 ? 0.5 + Math.random() * 0.6 : 1.2 + Math.random() * 0.9,
        o: 0.15 + dist * 0.6,
      });
    }
    return list;
  }, []);

  // Linhas apontando para o centro, quase invisíveis. É o que
  // faz o olho ir para a carta sem perceber por quê.
  const rays = useMemo(() => {
    const list: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const cx = width / 2;
    const cy = height / 2;

    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + 0.3;
      const outer = Math.max(width, height) * 0.75;
      const inner = width * (0.32 + (i % 3) * 0.06);
      list.push({
        x1: cx + Math.cos(angle) * inner,
        y1: cy + Math.sin(angle) * inner,
        x2: cx + Math.cos(angle) * outer,
        y2: cy + Math.sin(angle) * outer,
      });
    }
    return list;
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1, duration: 4200,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0, duration: 4200,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const glowOpacity = pulse.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.55, 1],
  });
  const glowScale = pulse.interpolate({
    inputRange:  [0, 1],
    outputRange: [1, 1.08],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Céu e estrelas — estáticos */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="destinyNeb" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#7B2FBE" stopOpacity="0.2" />
            <Stop offset="100%" stopColor="#7B2FBE" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill={colors.background} />

        <Ellipse cx={width * 0.5} cy={height * 0.42}
                 rx={width * 0.85} ry={height * 0.4}
                 fill="url(#destinyNeb)" />

        {rays.map((r, i) => (
          <Line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
                stroke={colors.gold} strokeWidth={0.6} opacity={0.07} />
        ))}

        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o} />
        ))}
      </Svg>

      {/* Brilho central — a única camada que respira */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      >
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="destinyCore" cx="50%" cy="45%" r="42%">
              <Stop offset="0%"   stopColor={colors.gold} stopOpacity="0.16" />
              <Stop offset="55%"  stopColor={colors.gold} stopOpacity="0.05" />
              <Stop offset="100%" stopColor={colors.gold} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#destinyCore)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
// ============================================
// LUMINA — FUNDO DA ABA SINTONIZE
// src/components/SintonizeBackground.tsx
//
// Um universo de astros e possibilidades atrás do card. A aba
// é sobre decidir por uma pessoa de cada vez, e o vazio do
// espaço ao redor é o que faz o card parecer flutuar.
//
// ── CUSTO ──
//
// Desenhado UMA vez e montado fora da lista: ele não
// re-renderiza quando o card muda, porque não depende de
// nenhum dado do perfil. As estrelas são posições fixas
// sorteadas na primeira montagem — sortear a cada render faria
// o céu piscar a cada troca de card.
//
// Uma única animação de deriva para o conjunto, no driver
// nativo. Estrelas piscando individualmente seriam bonitas e
// custariam um Animated.Value por estrela.
// ============================================

import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, Animated, Easing, Dimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop, Ellipse, Rect } from 'react-native-svg';
import { colors } from '../theme';

const { width, height } = Dimensions.get('window');

/** Estrelas ao todo. Acima de ~120 o SVG começa a pesar na
 *  montagem inicial sem ganho visual perceptível. */
const STAR_COUNT = 220;

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
}

export function SintonizeBackground() {
  const drift = useRef(new Animated.Value(0)).current;

  // Sorteadas UMA vez: recalcular a cada render faria o céu
  // inteiro mudar quando o usuário passa de card.
  const stars = useMemo<Star[]>(() => {
    const list: Star[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      list.push({
        x: Math.random() * width,
        y: Math.random() * height,
        // A maioria pequena, poucas grandes — céu real não tem
        // estrelas de tamanho uniforme.
        // Três faixas de tamanho: muitas pequenas ao fundo,
        // algumas médias, poucas grandes em primeiro plano. Dá
        // profundidade que uma distribuição uniforme não dá.
        r: Math.random() < 0.7
          ? 0.5 + Math.random() * 0.6
          : Math.random() < 0.88
            ? 1.1 + Math.random() * 0.7
            : 1.9 + Math.random() * 1.3,
        o: 0.2 + Math.random() * 0.7,
      });
    }
    return list;
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1, duration: 26000,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0, duration: 26000,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Deriva mínima: 14 pixels em 26 segundos. O bastante para o
  // fundo não parecer uma imagem parada, pouco o bastante para
  // não distrair de quem está no card.
  const translateY = drift.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, -14],
  });
  const translateX = drift.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 8],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Nebulosas: estáticas, porque são a profundidade do
          fundo. Se derivassem junto com as estrelas, o conjunto
          leria como uma imagem só deslizando. */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="nebA" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#7B2FBE" stopOpacity="0.22" />
            <Stop offset="100%" stopColor="#7B2FBE" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="nebB" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#1E5A8A" stopOpacity="0.18" />
            <Stop offset="100%" stopColor="#1E5A8A" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="nebC" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor={colors.gold} stopOpacity="0.09" />
            <Stop offset="100%" stopColor={colors.gold} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill={colors.background} />

        {/* Fora de eixo e de tamanhos diferentes: nuvens
            simétricas leem como decoração, não como espaço. */}
        <Ellipse
          cx={width * 0.22} cy={height * 0.2}
          rx={width * 0.55} ry={height * 0.22}
          fill="url(#nebA)"
          transform={`rotate(-18 ${width * 0.22} ${height * 0.2})`}
        />
        <Ellipse
          cx={width * 0.85} cy={height * 0.55}
          rx={width * 0.48} ry={height * 0.26}
          fill="url(#nebB)"
          transform={`rotate(24 ${width * 0.85} ${height * 0.55})`}
        />
        <Ellipse
          cx={width * 0.4} cy={height * 0.88}
          rx={width * 0.62} ry={height * 0.18}
          fill="url(#nebC)"
        />
      </Svg>

      {/* Estrelas: a única camada que deriva. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX }, { translateY }] },
        ]}
      >
        <Svg width={width} height={height}>
          {stars.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

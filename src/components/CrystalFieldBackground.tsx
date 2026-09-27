// ============================================
// LUMINA — CAMPO DE CRISTAIS
// src/components/CrystalFieldBackground.tsx
//
// O universo de cristais do Lumina, atrás da tela de compra.
//
// ── POR QUE DOURADO ──
//
// O CRYSTAL_VISUAL do economy.ts define o cristal premium
// como núcleo dourado com bordas roxas. É o que está à venda
// aqui — o fundo antecipa o que a pessoa vai levar.
//
// ── POR QUE DERIVA LENTA ──
//
// A tela é de DECISÃO: quatro pacotes com preços diferentes.
// Um fundo agitado rouba a atenção de quem está comparando.
// Os cristais levam quase um minuto para atravessar o próprio
// tamanho, e o giro é de poucos graus — percebe-se que está
// vivo sem que o olho seja puxado.
//
// ── CUSTO ──
//
// Um Animated.Value por cristal, todos no driver nativo. São
// sete: o suficiente para preencher sem pesar. Os caminhos
// são sorteados uma vez na montagem; recalcular a cada render
// faria o campo saltar.
// ============================================

import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, Animated, Easing, Dimensions, View } from 'react-native';
import Svg, {
  Path, Circle, Defs, RadialGradient, LinearGradient, Stop, Rect, G,
} from 'react-native-svg';
import { colors } from '../theme';

const { width, height } = Dimensions.get('window');

/** Sete cristais. Acima disso o fundo vira mosaico e compete
 *  com os cards de pacote. */
const CRYSTAL_COUNT = 7;

interface Floater {
  x:        number;
  y:        number;
  size:     number;
  opacity:  number;
  /** Quanto sobe e desce, em pixels. */
  drift:    number;
  /** Graus de giro — poucos, senão vira pião. */
  tilt:     number;
  duration: number;
  delay:    number;
}

export function CrystalFieldBackground() {
  const floaters = useMemo<Floater[]>(() => {
    const list: Floater[] = [];

    for (let i = 0; i < CRYSTAL_COUNT; i++) {
      // Distribuídos pela altura, com desvio lateral para não
      // formarem coluna. Os das bordas são maiores: dá
      // profundidade e deixa o miolo livre para os cards.
      const t = (i + 0.5) / CRYSTAL_COUNT;
      const edge = i % 2 === 0 ? 0.12 : 0.85;

      list.push({
        x:       width * (edge + ((i * 0.13) % 0.12) - 0.06),
        y:       height * (0.08 + t * 0.82),
        size:    i % 3 === 0 ? 58 : i % 3 === 1 ? 42 : 32,
        // 50% mais aparentes que a primeira versão (0.22/0.14):
        // com o fundo escuro do app e o card dos pacotes quase
        // opaco por cima, o dourado sumia.
        opacity: i % 3 === 0 ? 0.33 : 0.21,
        drift:   14 + (i % 4) * 6,
        tilt:    5 + (i % 3) * 4,
        // Durações diferentes: com todas iguais o campo pulsa
        // em bloco e a mecânica fica exposta.
        duration: 9000 + (i % 5) * 2400,
        delay:    i * 700,
      });
    }

    return list;
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Céu de fundo, estático */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="fieldGlow" cx="50%" cy="38%" r="62%">
            <Stop offset="0%"   stopColor={colors.gold} stopOpacity="0.1" />
            <Stop offset="55%"  stopColor="#7B2FBE"     stopOpacity="0.06" />
            <Stop offset="100%" stopColor="#7B2FBE"     stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={colors.background} />
        <Rect x={0} y={0} width={width} height={height} fill="url(#fieldGlow)" />

        {/* Poeira estelar entre os cristais */}
        {Array.from({ length: 40 }).map((_, i) => {
          const x = ((i * 137.5) % 100) / 100 * width;
          const y = ((i * 61.8)  % 100) / 100 * height;
          return (
            <Circle key={i} cx={x} cy={y}
                    r={i % 5 === 0 ? 1.4 : 0.7}
                    fill="#FFFFFF" opacity={i % 5 === 0 ? 0.28 : 0.14} />
          );
        })}
      </Svg>

      {floaters.map((f, i) => (
        <FloatingCrystal key={i} floater={f} index={i} />
      ))}
    </View>
  );
}

function FloatingCrystal({ floater, index }: { floater: Floater; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(floater.delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: floater.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: floater.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Sobe e desce, gira poucos graus, e brilha um pouco mais no
  // alto do percurso — como algo suspenso em gravidade zero.
  const translateY = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [floater.drift, -floater.drift],
  });
  const rotate = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [`-${floater.tilt}deg`, `${floater.tilt}deg`],
  });
  // O pico do percurso brilha mais: reforça a sensação de
  // algo suspenso, girando em gravidade zero.
  const opacity = anim.interpolate({
    inputRange:  [0, 0.5, 1],
    outputRange: [floater.opacity, Math.min(1, floater.opacity * 1.6), floater.opacity],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: floater.x - floater.size / 2,
        top:  floater.y - floater.size / 2,
        opacity,
        transform: [{ translateY }, { rotate }],
      }}
    >
      <GoldCrystal size={floater.size} seed={index} />
    </Animated.View>
  );
}

/**
 * O cristal dourado. Mesma anatomia do ícone da aba — face
 * escura, face clara, chanfro no topo e um reflexo — mas na
 * paleta premium do CRYSTAL_VISUAL: núcleo dourado, bordas
 * roxas.
 */
function GoldCrystal({ size, seed }: { size: number; seed: number }) {
  const uid = `gc${seed}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={`faceL${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%"   stopColor="#B8860B" />
          <Stop offset="100%" stopColor="#5C3A0A" />
        </LinearGradient>
        <LinearGradient id={`faceR${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%"   stopColor="#FFD700" />
          <Stop offset="100%" stopColor="#B8860B" />
        </LinearGradient>
        <LinearGradient id={`top${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%"   stopColor="#FFF3C4" />
          <Stop offset="100%" stopColor="#FFD700" />
        </LinearGradient>
      </Defs>

      <G>
        {/* Face esquerda, na sombra */}
        <Path d="M 12 1.5 L 3.5 8.6 L 12 22.5 Z" fill={`url(#faceL${uid})`} />
        {/* Face direita, iluminada. A aresta entre as duas é o
            que cria o volume. */}
        <Path d="M 12 1.5 L 20.5 8.6 L 12 22.5 Z" fill={`url(#faceR${uid})`} />
        {/* Chanfro do topo: sem ele a ponta fica afiada demais
            e o cristal vira seta. */}
        <Path
          d="M 12 1.5 L 3.5 8.6 L 8 7.2 L 12 5.4 L 16 7.2 L 20.5 8.6 Z"
          fill={`url(#top${uid})`}
          opacity={0.92}
        />
        {/* Contorno roxo — a borda do cristal premium. */}
        <Path
          d="M 12 1.5 L 20.5 8.6 L 12 22.5 L 3.5 8.6 Z"
          stroke="#7B2FBE"
          strokeWidth={0.7}
          fill="none"
          opacity={0.65}
        />
        {/* Reflexo: a lasca que faz o olho ler vidro, não pedra. */}
        <Path d="M 12.9 6.4 L 16.6 9.4 L 13.4 15.5 Z" fill="#FFFFFF" opacity={0.3} />
      </G>
    </Svg>
  );
}

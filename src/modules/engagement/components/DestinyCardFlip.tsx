// ============================================
// LUMINA — A CARTA DO DESTINO
// src/modules/engagement/components/DestinyCardFlip.tsx
//
// A carta fechada com o selo do Lumina, a virada em 3D, e o
// interior com as duas pessoas lado a lado.
//
// ── POR QUE AO TOQUE ──
//
// A virada rodando sozinha ao abrir a tela tiraria a
// participação da pessoa. O gesto de virar É o momento — por
// isso o verso pulsa devagar e diz o que fazer, e a animação
// só começa quando ela toca.
//
// ── A VIRADA ──
//
// `rotateY` de 0 a 180 graus com perspectiva. As duas faces
// existem ao mesmo tempo, empilhadas: a frente some em 90
// graus e o verso aparece, o que evita o "recorte" de
// trocar o conteúdo no meio do giro.
//
// Tudo no driver nativo — a virada precisa ser fluida ou o
// momento se perde.
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing,
  TouchableOpacity, Dimensions,
} from 'react-native';
import Svg, {
  Circle, Path, G, Defs, RadialGradient, LinearGradient, Stop, Line, Ellipse,
} from 'react-native-svg';
import { colors, fonts, spacing, borderRadius } from '../../../theme';

const { width } = Dimensions.get('window');
const CARD_W = Math.min(width - spacing.lg * 2, 380);
const CARD_H = CARD_W * 1.42;

interface Props {
  /** Bloqueia o toque enquanto a carta está sendo sorteada. */
  disabled?: boolean;
  /** Chamado quando a virada termina. */
  onOpened: () => void;
  /** O conteúdo do interior — as duas pessoas. */
  children: React.ReactNode;
  /** Reabre fechada quando a pessoa pede outra carta. */
  resetKey: number;
}

export function DestinyCardFlip({ disabled, onOpened, children, resetKey }: Props) {
  const flip    = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  const [opened, setOpened] = useState(false);

  // Carta nova volta a ficar fechada: quem paga por outra tem
  // direito ao mesmo momento de virar.
  useEffect(() => {
    setOpened(false);
    flip.setValue(0);
  }, [resetKey]);

  // O verso respira enquanto espera — é o que diz "tem algo
  // aqui" sem precisar de seta piscando.
  useEffect(() => {
    if (opened) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1.025, duration: 1700,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 1, duration: 1700,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opened]);

  function handleFlip() {
    if (disabled || opened) return;

    setOpened(true);
    Animated.timing(flip, {
      toValue: 1,
      duration: 900,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onOpened());
  }

  const frontRotate = flip.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flip.interpolate({
    inputRange:  [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  // A troca acontece exatamente no perfil, aos 90 graus —
  // antes disso a face de trás apareceria espelhada.
  const frontOpacity = flip.interpolate({
    inputRange:  [0, 0.49, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flip.interpolate({
    inputRange:  [0, 0.5, 0.51, 1],
    outputRange: [0, 0, 1, 1],
  });

  return (
    <View style={styles.stage}>
      {/* VERSO — o que a pessoa vê antes de tocar */}
      <Animated.View
        style={[
          styles.face,
          {
            opacity: frontOpacity,
            transform: [
              { perspective: 1200 },
              { rotateY: frontRotate },
              { scale: opened ? 1 : breathe },
            ],
          },
        ]}
        pointerEvents={opened ? 'none' : 'auto'}
      >
        <TouchableOpacity
          style={styles.backFace}
          onPress={handleFlip}
          disabled={disabled}
          activeOpacity={0.92}
        >
          <CardBack />
          <View style={styles.tapHint}>
            <Text style={styles.tapHintText}>Toque para revelar</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* FRENTE — as duas pessoas */}
      <Animated.View
        style={[
          styles.face,
          styles.frontFace,
          {
            opacity: backOpacity,
            transform: [
              { perspective: 1200 },
              { rotateY: backRotate },
            ],
          },
        ]}
        pointerEvents={opened ? 'auto' : 'none'}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * O verso: o selo do Lumina sobre um céu com constelação.
 *
 * Desenhado e não imagem — o SVG escala em qualquer tela e
 * acompanha o tema sem precisar de três resoluções de PNG.
 */
function CardBack() {
  return (
    <Svg width={CARD_W} height={CARD_H} viewBox={`0 0 ${CARD_W} ${CARD_H}`}>
      <Defs>
        <LinearGradient id="cardBackBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%"   stopColor="#1A0A2E" />
          <Stop offset="55%"  stopColor="#0D0618" />
          <Stop offset="100%" stopColor="#2D1B4E" />
        </LinearGradient>
        <RadialGradient id="cardBackGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={colors.gold} stopOpacity="0.22" />
          <Stop offset="70%"  stopColor={colors.gold} stopOpacity="0.04" />
          <Stop offset="100%" stopColor={colors.gold} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Path
        d={`M 0 0 H ${CARD_W} V ${CARD_H} H 0 Z`}
        fill="url(#cardBackBg)"
      />

      {/* Moldura dupla, como numa carta de baralho */}
      <Path
        d={`M 14 14 H ${CARD_W - 14} V ${CARD_H - 14} H 14 Z`}
        stroke={colors.gold} strokeWidth={1.4} fill="none" opacity={0.55}
      />
      <Path
        d={`M 20 20 H ${CARD_W - 20} V ${CARD_H - 20} H 20 Z`}
        stroke={colors.gold} strokeWidth={0.6} fill="none" opacity={0.3}
      />

      {/* Estrelas fixas, espalhadas de forma irregular */}
      {[
        [0.18, 0.12, 1.4], [0.72, 0.09, 1], [0.86, 0.22, 1.7],
        [0.12, 0.31, 1], [0.91, 0.44, 1.2], [0.08, 0.58, 1.5],
        [0.24, 0.79, 1.1], [0.78, 0.71, 1.4], [0.55, 0.88, 1],
        [0.33, 0.93, 1.6], [0.66, 0.2, 1], [0.44, 0.07, 1.2],
      ].map(([fx, fy, r], i) => (
        <Circle key={i} cx={CARD_W * fx} cy={CARD_H * fy} r={r}
                fill="#FFFFFF" opacity={0.35 + (i % 3) * 0.2} />
      ))}

      <Circle cx={CARD_W / 2} cy={CARD_H / 2} r={CARD_W * 0.42} fill="url(#cardBackGlow)" />

      {/* Selo central */}
      <G>
        <Circle cx={CARD_W / 2} cy={CARD_H / 2} r={52}
                stroke={colors.gold} strokeWidth={1.6} fill="none" opacity={0.85} />
        <Circle cx={CARD_W / 2} cy={CARD_H / 2} r={58}
                stroke={colors.gold} strokeWidth={0.7} fill="none" opacity={0.4} />

        {/* Raios em volta do selo */}
        {Array.from({ length: 12 }).map((_, i) => (
          <Line
            key={i}
            x1={CARD_W / 2} y1={CARD_H / 2 - 62}
            x2={CARD_W / 2} y2={CARD_H / 2 - (i % 2 === 0 ? 70 : 66)}
            stroke={colors.gold} strokeWidth={i % 2 === 0 ? 1.6 : 0.9}
            strokeLinecap="round" opacity={i % 2 === 0 ? 0.8 : 0.4}
            transform={`rotate(${i * 30} ${CARD_W / 2} ${CARD_H / 2})`}
          />
        ))}

        {/* Órbitas cruzadas — o símbolo do encontro */}
        <Ellipse cx={CARD_W / 2} cy={CARD_H / 2} rx={38} ry={15}
                 stroke={colors.gold} strokeWidth={1.2} fill="none" opacity={0.7}
                 transform={`rotate(-25 ${CARD_W / 2} ${CARD_H / 2})`} />
        <Ellipse cx={CARD_W / 2} cy={CARD_H / 2} rx={38} ry={15}
                 stroke={colors.gold} strokeWidth={1.2} fill="none" opacity={0.7}
                 transform={`rotate(25 ${CARD_W / 2} ${CARD_H / 2})`} />

        <Circle cx={CARD_W / 2 - 17} cy={CARD_H / 2 - 8} r={6} fill={colors.gold} />
        <Circle cx={CARD_W / 2 + 17} cy={CARD_H / 2 + 8} r={6} fill="#B57BEE" />
        <Circle cx={CARD_W / 2} cy={CARD_H / 2} r={3.4} fill="#FFFFFF" opacity={0.9} />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  stage: {
    width:  CARD_W,
    height: CARD_H,
    alignSelf: 'center',
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  backFace: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  frontFace: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gold + '44',
  },
  tapHint: {
    position: 'absolute',
    bottom: spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tapHintText: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
});
// ============================================
// LUMINA — AURA DE PRESTÍGIO
// src/components/profile/PrestigeAura.tsx
//
// Energia EMANANDO do card. Duas tentativas foram descartadas
// antes desta: partículas em órbita (apareciam por cima da
// foto) e faixas simétricas (liam como gota, não como chama).
//
// ── COMO O MOVIMENTO É FEITO ──
//
// Animar o `d` do Path daria ondulação real, mas não funciona
// com driver nativo e rodaria na thread JS — caro num feed.
// Em vez disso, três coisas que o driver nativo faz sozinho:
//
// 1. TRÊS ESTADOS da mesma chama, com ondulações diferentes,
//    em ciclo. Dois estados davam um vai-e-volta previsível;
//    três quebram o padrão e leem como fogo.
// 2. TEMPO PRÓPRIO por camada. Com todas piscando juntas, a
//    mecânica ficava exposta.
// 3. SUBIDA: translateY e escala sutis, como energia fluindo.
//    É o que mais acrescenta realismo.
//
// ── A FORMA ──
//
// Base larga, ponta afinada e desviada, assimétrica. Uma
// cúbica de cada lado com pontos de controle diferentes —
// duas quadráticas simétricas não bastam. Três camadas de
// temperatura: corpo, núcleo claro, ponta dissolvendo.
// ============================================

import React, { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Animated, Easing, View } from 'react-native';
import Svg, { Path, Defs, RadialGradient, LinearGradient, Stop, Rect, Ellipse } from 'react-native-svg';

interface Props {
  color:     string;
  /** 0 a 1 — cresce com o estágio. */
  intensity: number;
  /** Só 3 e 4 animam; os demais ficam estáticos. */
  animated:  boolean;
  width:     number;
  height:    number;
}

interface Flame {
  x:    number;
  w:    number;
  h:    number;
  sway: number;
  o:    number;
}

let auraIdCounter = 0;

/** Durações diferentes por camada — o que quebra a sincronia. */
const LAYER_DURATIONS = [1500, 2100, 1800];

export function PrestigeAura({ color, intensity, animated, width, height }: Props) {
  const uid = useMemo(() => `aura${(auraIdCounter++).toString(36)}`, []);

  // Um valor por camada, cada um no seu tempo.
  const fadeA = useRef(new Animated.Value(1)).current;
  const fadeB = useRef(new Animated.Value(0.2)).current;
  const fadeC = useRef(new Animated.Value(0.5)).current;
  // Subida compartilhada: é o movimento do conjunto, não de
  // cada chama.
  const rise  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;

    function pulse(value: Animated.Value, duration: number, delay: number) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1, duration,
            easing: Easing.inOut(Easing.sin), useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.18, duration: duration * 1.15,
            easing: Easing.inOut(Easing.sin), useNativeDriver: true,
          }),
        ]),
      );
    }

    const loops = [
      pulse(fadeA, LAYER_DURATIONS[0], 0),
      pulse(fadeB, LAYER_DURATIONS[1], 420),
      pulse(fadeC, LAYER_DURATIONS[2], 840),
      Animated.loop(
        Animated.sequence([
          Animated.timing(rise, {
            toValue: 1, duration: 2600,
            easing: Easing.out(Easing.quad), useNativeDriver: true,
          }),
          Animated.timing(rise, {
            toValue: 0, duration: 0, useNativeDriver: true,
          }),
        ]),
      ),
    ];

    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [animated]);

  // Densidade dobrada: oito chamas separadas liam como oito
  // riscos nas laterais. Vinte sobrepostas leem como fogo.
  const count = Math.max(8, Math.round(intensity * 22));

  const flames = useMemo<Flame[]>(() => {
    const list: Flame[] = [];
    for (let i = 0; i < count; i++) {
      // Distribuídas por TODA a base, não só nas laterais. A
      // versão anterior deixava o miolo vazio e o conjunto
      // parecia moldura, não energia.
      //
      // O jitter tira a regularidade: posições equidistantes
      // leem como cerca.
      const t = (i + 0.5) / count;
      const jitter = ((i * 0.37) % 1 - 0.5) * (width / count) * 0.9;
      const x = width * t + jitter;

      // As do CENTRO são mais baixas: a foto fica no meio, e
      // chamas altas ali competiriam com ela. Nas bordas sobem
      // livres.
      const edgeness = Math.abs(t - 0.5) * 2; // 0 no centro, 1 nas bordas
      const heightMul = 0.28 + edgeness * 0.55;

      list.push({
        x,
        w: 18 + (i % 4) * 9,
        h: height * heightMul * (0.85 + ((i * 0.23) % 0.4)),
        // Desvio menor: 19px jogava as pontas para o lado e
        // criava arcos. Fogo sobe quase reto.
        sway: ((i % 2 === 0) ? 1 : -1) * (3 + (i % 3) * 3),
        o: 0.55 + ((i * 0.19) % 0.45),
      });
    }
    return list;
  }, [count, width, height]);

  // A subida: sobe um pouco e cresce, depois volta ao início
  // sem transição — como uma labareda que se desfaz no topo e
  // outra nasce na base.
  const translateY = rise.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, -height * 0.07],
  });
  const scaleY = rise.interpolate({
    inputRange:  [0, 1],
    outputRange: [1, 1.09],
  });
  const riseFade = rise.interpolate({
    inputRange:  [0, 0.75, 1],
    outputRange: [1, 0.85, 0],
  });

  const riseStyle = animated
    ? { transform: [{ translateY }, { scaleY }], opacity: riseFade }
    : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Camada estática: brilho e brasa. Fora da animação
          porque não muda — redesenhar a cada quadro seria
          desperdício. */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`glow${uid}`} cx="50%" cy="50%" r="72%">
            <Stop offset="0%"   stopColor={color} stopOpacity="0" />
            <Stop offset="52%"  stopColor={color} stopOpacity={String(intensity * 0.10)} />
            <Stop offset="100%" stopColor={color} stopOpacity={String(intensity * 0.40)} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#glow${uid})`} />
        <Ellipse
          cx={width / 2} cy={height}
          rx={width * 0.5} ry={height * 0.07}
          fill={color} opacity={intensity * 0.35}
        />
      </Svg>

      {/* As três camadas sobem juntas; a opacidade de cada uma
          tem tempo próprio. */}
      <Animated.View style={[StyleSheet.absoluteFill, riseStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: animated ? fadeA : 1 }]}>
          <FlameLayer
            flames={flames} color={color} intensity={intensity}
            width={width} height={height} uid={`${uid}a`} phase={1} squash={1}
          />
        </Animated.View>

        {animated && (
          <>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeB }]}>
              <FlameLayer
                flames={flames} color={color} intensity={intensity}
                width={width} height={height} uid={`${uid}b`} phase={-1} squash={0.88}
              />
            </Animated.View>

            <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeC }]}>
              <FlameLayer
                flames={flames} color={color} intensity={intensity}
                width={width} height={height} uid={`${uid}c`} phase={0.45} squash={1.12}
              />
            </Animated.View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

interface LayerProps {
  flames:    Flame[];
  color:     string;
  intensity: number;
  width:     number;
  height:    number;
  uid:       string;
  /** Multiplica o desvio da ponta — muda a ondulação. */
  phase:     number;
  /** Multiplica a altura — camadas de tamanhos diferentes. */
  squash:    number;
}

function FlameLayer({
  flames, color, intensity, width, height, uid, phase, squash,
}: LayerProps) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        {/* Opacidades quase dobradas. Com os valores antigos e
            o intensity multiplicando, as chamas saíam em torno
            de 30% — quase invisíveis contra o fundo escuro. */}
        <LinearGradient id={`body${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <Stop offset="0%"   stopColor={color} stopOpacity={String(Math.min(1, intensity * 1.3))} />
          <Stop offset="45%"  stopColor={color} stopOpacity={String(intensity * 0.8)} />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id={`core${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity={String(intensity * 0.8)} />
          <Stop offset="55%"  stopColor={color}   stopOpacity={String(intensity * 0.4)} />
          <Stop offset="100%" stopColor={color}   stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {flames.map((f, i) => {
        const h    = f.h * squash;
        const base = height + 2;
        const top  = base - h;
        const mid  = base - h * 0.55;
        const sway = f.sway * phase;
        const tipX = f.x + sway;

        const body = [
          `M ${f.x - f.w / 2} ${base}`,
          `C ${f.x - f.w / 2 - 3} ${mid} ${tipX - f.w * 0.3} ${top + h * 0.18} ${tipX} ${top}`,
          `C ${tipX + f.w * 0.28} ${top + h * 0.2} ${f.x + f.w / 2 + 2} ${mid} ${f.x + f.w / 2} ${base}`,
          'Z',
        ].join(' ');

        const coreW   = f.w * 0.42;
        const coreTop = base - h * 0.62;
        const coreTip = f.x + sway * 0.6;
        const core = [
          `M ${f.x - coreW / 2} ${base}`,
          `C ${f.x - coreW / 2} ${mid} ${coreTip - coreW * 0.3} ${coreTop + h * 0.14} ${coreTip} ${coreTop}`,
          `C ${coreTip + coreW * 0.3} ${coreTop + h * 0.14} ${f.x + coreW / 2} ${mid} ${f.x + coreW / 2} ${base}`,
          'Z',
        ].join(' ');

        return (
          <React.Fragment key={i}>
            <Path d={body} fill={`url(#body${uid})`} opacity={f.o} />
            <Path d={core} fill={`url(#core${uid})`} opacity={f.o * 0.8} />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
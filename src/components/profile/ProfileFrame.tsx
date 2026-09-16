// ============================================
// LUMINA — PROFILE FRAME v3.0
// src/components/profile/ProfileFrame.tsx
//
// FASE 8 — a moldura virou CENA.
//
// v2 desenhava uma borda colada na foto: "Via Láctea — cem
// bilhões de estrelas ao seu redor" aparecia como um anel
// dourado. Vender isso por 150 cristais é prometer e não entregar.
//
// Agora cada moldura ocupa o espaço ao redor da foto com um SVG
// de camadas — espirais, discos de acreção, cortinas de aurora —
// e tem animação própria. A foto fica circular no centro.
//
// CORTE POR TAMANHO: abaixo de 80px a cena vira borrão, então o
// componente cai para um anel simples com as cores da moldura.
// Isso preserva os usos em 26px (linha do nome) e 40px (perfil).
// ============================================

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Image, StyleSheet, ViewStyle, Animated, Easing } from 'react-native';
import Svg, {
  Circle, Ellipse, Path, G, Defs, RadialGradient, LinearGradient, Stop,
} from 'react-native-svg';
import { COLORS, TIER_COLORS, TIER_GLOW, SHADOWS } from '../../theme/tokens';
import { getFrameAsset } from '../../assets';

type Tier = 'comum' | 'raro' | 'epico' | 'lendario' | 'galaxia';

export type FrameScene =
  | 'nebulosa' | 'eclipse' | 'maresia' | 'supernova'
  | 'aurora' | 'cometa' | 'buraco_negro' | 'via_lactea'
  | 'conquista';

export interface FrameAppearance {
  borderColor: string;
  glowColor:   string;
  borderWidth: number;
  animated:    boolean;
  /** Cena a desenhar ao redor da foto. Ausente = só o anel. */
  scene?:      FrameScene;
}

interface ProfileFrameProps {
  photoURL:   string;
  tier?:      Tier;
  frame?:     FrameAppearance | null;
  size?:      number;
  style?:     ViewStyle;
}

// A cena é desenhada num viewBox de 100x100 com a foto ocupando
// o círculo central de raio 30 — sobra o anel de 30 a 50 para a
// moldura acontecer.
const VB    = 100;
const C     = VB / 2;
const PHOTO = 30;

const SCENE_MIN_SIZE = 80;

interface SceneProps { border: string; glow: string; uid: string }

function SceneViaLactea({ border, glow, uid }: SceneProps) {
  const stars: [number, number, number][] = [
    [16, 38, 1.5], [24, 24, 1.1], [38, 15, 1.7], [54, 12, 1.2],
    [70, 18, 1.5], [82, 32, 1.1], [88, 50, 1.6], [82, 68, 1.2],
    [68, 82, 1.5], [50, 88, 1.1], [32, 84, 1.6], [18, 70, 1.2],
    [12, 54, 1.4], [76, 78, 1.0], [26, 66, 1.3],
  ];
  return (
    <G>
      <Defs>
        <RadialGradient id={`mwHalo${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="30%" stopColor={border} stopOpacity="0" />
          <Stop offset="62%" stopColor={border} stopOpacity="0.28" />
          <Stop offset="100%" stopColor={border} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C} r={49} fill={`url(#mwHalo${uid})`} />
      {/* Braços espirais varrendo o entorno */}
      {[0, 120, 240].map(deg => (
        <Path key={deg}
              d={`M ${C + 32} ${C} Q ${C + 44} ${C - 26} ${C + 10} ${C - 44}`}
              stroke={border} strokeWidth={5} fill="none"
              opacity={0.22} strokeLinecap="round"
              transform={`rotate(${deg} ${C} ${C})`} />
      ))}
      {stars.map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" opacity={0.9} />
      ))}
    </G>
  );
}

function SceneBuracoNegro({ border, glow, uid }: SceneProps) {
  return (
    <G>
      <Defs>
        <LinearGradient id={`bhDisk${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%"   stopColor={glow}   stopOpacity="0.15" />
          <Stop offset="50%"  stopColor="#FFD700" stopOpacity="0.85" />
          <Stop offset="100%" stopColor={glow}   stopOpacity="0.15" />
        </LinearGradient>
      </Defs>
      {/* Disco de acreção em perspectiva */}
      <Ellipse cx={C} cy={C} rx={48} ry={15} stroke={`url(#bhDisk${uid})`}
               strokeWidth={7} fill="none" />
      <Ellipse cx={C} cy={C} rx={42} ry={12} stroke="#FFD700"
               strokeWidth={2} fill="none" opacity={0.45} />
      <Ellipse cx={C} cy={C} rx={36} ry={9} stroke="#FFD700"
               strokeWidth={1.2} fill="none" opacity={0.25} />
      {/* Luz curvando por cima */}
      <Path d={`M ${C - 46} ${C} Q ${C} ${C - 50} ${C + 46} ${C}`}
            stroke="#FFD700" strokeWidth={2} fill="none" opacity={0.5} />
    </G>
  );
}

function SceneSupernova({ border, glow, uid }: SceneProps) {
  const rays = Array.from({ length: 20 }, (_, i) => (i * 360) / 20);
  return (
    <G>
      <Defs>
        <RadialGradient id={`snGrad${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="58%" stopColor={border} stopOpacity="0.5" />
          <Stop offset="80%" stopColor={border} stopOpacity="0.18" />
          <Stop offset="100%" stopColor={border} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C} r={50} fill={`url(#snGrad${uid})`} />
      {rays.map((deg, i) => (
        <Path key={i} d={`M ${C} 4 L ${C - 1.8} 20 L ${C + 1.8} 20 Z`}
              fill={border} opacity={i % 2 === 0 ? 0.7 : 0.3}
              transform={`rotate(${deg} ${C} ${C})`} />
      ))}
      <Circle cx={C} cy={C} r={44} stroke={border} strokeWidth={1.5}
              fill="none" opacity={0.4} />
      <Circle cx={C} cy={C} r={37} stroke={border} strokeWidth={2.5}
              fill="none" opacity={0.6} />
    </G>
  );
}

function SceneAurora({ border, glow, uid }: SceneProps) {
  return (
    <G>
      <Defs>
        <LinearGradient id={`auGrad${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <Stop offset="0%"   stopColor={border}  stopOpacity="0" />
          <Stop offset="45%"  stopColor={border}  stopOpacity="0.55" />
          <Stop offset="100%" stopColor="#FF8FD4" stopOpacity="0.15" />
        </LinearGradient>
      </Defs>
      {/* Cortinas ondulantes ao redor */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
        <Path key={deg}
              d={`M ${C - 4} 8 Q ${C + 5} 20 ${C - 3} 32`}
              stroke={`url(#auGrad${uid})`}
              strokeWidth={i % 2 === 0 ? 7 : 4.5}
              fill="none" strokeLinecap="round"
              transform={`rotate(${deg} ${C} ${C})`} />
      ))}
      <Circle cx={C} cy={C} r={46} stroke={border} strokeWidth={1}
              fill="none" opacity={0.2} />
    </G>
  );
}

function SceneCometa({ border, glow, uid }: SceneProps) {
  return (
    <G>
      <Defs>
        <LinearGradient id={`cmTail${uid}`} x1="100%" y1="0%" x2="0%" y2="0%">
          <Stop offset="0%"   stopColor={border} stopOpacity="0.9" />
          <Stop offset="100%" stopColor={border} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {/* Órbita */}
      <Circle cx={C} cy={C} r={42} stroke={border} strokeWidth={0.8}
              fill="none" opacity={0.25} strokeDasharray="3 7" />
      {/* Cauda ao longo da órbita */}
      <Path d={`M ${C + 42} ${C} A 42 42 0 0 0 ${C} ${C - 42}`}
            stroke={`url(#cmTail${uid})`} strokeWidth={9}
            fill="none" strokeLinecap="round" />
      <Path d={`M ${C + 42} ${C} A 42 42 0 0 0 ${C + 22} ${C - 36}`}
            stroke={border} strokeWidth={4} fill="none"
            opacity={0.6} strokeLinecap="round" />
      {/* Núcleo */}
      <Circle cx={C + 42} cy={C} r={9} fill={border} opacity={0.3} />
      <Circle cx={C + 42} cy={C} r={5} fill="#FFFFFF" />
    </G>
  );
}

function SceneNebulosa({ border, glow, uid }: SceneProps) {
  return (
    <G>
      <Defs>
        <RadialGradient id={`nbGrad${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="55%" stopColor={border} stopOpacity="0.35" />
          <Stop offset="85%" stopColor={border} stopOpacity="0.12" />
          <Stop offset="100%" stopColor={border} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C} r={50} fill={`url(#nbGrad${uid})`} />
      {[0, 72, 144, 216, 288].map((deg, i) => (
        <Ellipse key={deg} cx={C} cy={C - 39} rx={17} ry={9}
                 fill={border} opacity={i % 2 === 0 ? 0.22 : 0.14}
                 transform={`rotate(${deg} ${C} ${C})`} />
      ))}
      {[[C, 12], [C + 30, 26], [C + 38, C + 18], [C - 32, C + 24], [C - 30, 28]].map(
        ([x, y], i) => <Circle key={i} cx={x} cy={y} r={1.6} fill="#FFFFFF" opacity={0.85} />
      )}
    </G>
  );
}

function SceneEclipse({ border, glow, uid }: SceneProps) {
  return (
    <G>
      <Defs>
        <RadialGradient id={`ecCorona${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="60%" stopColor="#FFE9A8" stopOpacity="0" />
          <Stop offset="68%" stopColor="#FFE9A8" stopOpacity="0.7" />
          <Stop offset="100%" stopColor="#FFE9A8" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C} r={50} fill={`url(#ecCorona${uid})`} />
      {/* Coroa irregular */}
      {Array.from({ length: 24 }, (_, i) => (i * 360) / 24).map((deg, i) => (
        <Path key={deg} d={`M ${C} ${C - 33} L ${C} ${C - (i % 3 === 0 ? 47 : 40)}`}
              stroke="#FFE9A8" strokeWidth={i % 3 === 0 ? 1.8 : 1}
              opacity={i % 3 === 0 ? 0.55 : 0.28}
              transform={`rotate(${deg} ${C} ${C})`} />
      ))}
      {/* Protuberância */}
      <Circle cx={C + 24} cy={C - 24} r={4} fill="#FFE9A8" opacity={0.8} />
      <Circle cx={C + 24} cy={C - 24} r={8} fill="#FFE9A8" opacity={0.2} />
    </G>
  );
}

function SceneMaresia({ border, glow, uid }: SceneProps) {
  return (
    <G>
      {[34, 39, 44, 49].map((r, i) => (
        <Circle key={r} cx={C} cy={C} r={r} stroke={border}
                strokeWidth={i === 0 ? 2.5 : 1.4}
                fill="none" opacity={0.5 - i * 0.1} />
      ))}
      {/* Reflexo de luar */}
      <Path d={`M ${C - 20} ${C - 34} Q ${C} ${C - 44} ${C + 20} ${C - 34}`}
            stroke="#FFFFFF" strokeWidth={2} fill="none" opacity={0.3} />
      <Circle cx={C + 30} cy={C - 28} r={3} fill="#FFFFFF" opacity={0.5} />
    </G>
  );
}

function SceneConquista({ border, glow, uid }: SceneProps) {
  // Molduras de conquista são sóbrias de propósito: o valor delas
  // é serem permanentes, não chamativas.
  return (
    <G>
      <Circle cx={C} cy={C} r={38} stroke={border} strokeWidth={2.5}
              fill="none" opacity={0.85} />
      <Circle cx={C} cy={C} r={43} stroke={border} strokeWidth={0.8}
              fill="none" opacity={0.35} strokeDasharray="2 5" />
      {[0, 90, 180, 270].map(deg => (
        <Circle key={deg} cx={C} cy={C - 38} r={2.5} fill={border}
                transform={`rotate(${deg} ${C} ${C})`} />
      ))}
    </G>
  );
}

const SCENES: Record<FrameScene, React.FC<SceneProps>> = {
  via_lactea:   SceneViaLactea,
  buraco_negro: SceneBuracoNegro,
  supernova:    SceneSupernova,
  aurora:       SceneAurora,
  cometa:       SceneCometa,
  nebulosa:     SceneNebulosa,
  eclipse:      SceneEclipse,
  maresia:      SceneMaresia,
  conquista:    SceneConquista,
};

// Cenas que giram. Aurora e Maresia pulsam em vez de girar —
// cortina e onda girando ficam esquisitas.
const SPINNING: FrameScene[] = [
  'via_lactea', 'buraco_negro', 'cometa', 'nebulosa', 'eclipse',
];

let frameIdCounter = 0;

export function ProfileFrame({
  photoURL,
  tier  = 'comum',
  frame = null,
  size  = 80,
  style,
}: ProfileFrameProps) {
  const frameAsset = getFrameAsset(tier);

  const borderColor = frame?.borderColor ?? TIER_COLORS[tier];
  const glowColor   = frame?.glowColor   ?? TIER_GLOW[tier];
  const borderWidth = frame
    ? frame.borderWidth
    : tier === 'comum' ? 0 : tier === 'galaxia' ? 3 : 2;

  const hasGlow  = frame !== null || tier !== 'comum';
  const showScene = frame?.scene !== undefined && size >= SCENE_MIN_SIZE;

  const uid = useMemo(() => `f${(frameIdCounter++).toString(36)}`, []);

  const spin  = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  const spins = showScene
    && frame!.animated
    && SPINNING.includes(frame!.scene!);
  const pulses = frame?.animated && !spins;

  useEffect(() => {
    if (!spins) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1, duration: 26000,
        easing: Easing.linear, useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spins]);

  useEffect(() => {
    if (!pulses) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 1900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 1900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulses]);

  const rotation = spin.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── Cena completa ──
  if (showScene) {
    const Scene     = SCENES[frame!.scene!];
    const photoSize = size * (PHOTO * 2 / VB);

    return (
      <View
        style={[
          styles.sceneWrap,
          {
            width:  size,
            height: size,
            shadowColor:   glowColor,
            shadowRadius:  size * 0.16,
            shadowOpacity: 1,
            elevation:     8,
          },
          style,
        ]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            spins  ? { transform: [{ rotate: rotation }] } : null,
            pulses ? { opacity: pulse } : null,
          ]}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
            <Scene border={borderColor} glow={glowColor} uid={uid} />
          </Svg>
        </Animated.View>

        <Image
          source={{ uri: photoURL }}
          style={{
            width:        photoSize,
            height:       photoSize,
            borderRadius: photoSize / 2,
            borderWidth:  1.5,
            borderColor,
          }}
          resizeMode="cover"
        />
      </View>
    );
  }

  // ── Anel simples: tamanhos pequenos e tiers sem moldura ──
  const outer = size + borderWidth * 2 + 4;

  return (
    <Animated.View
      style={[
        {
          width:        outer,
          height:       outer,
          borderRadius: outer / 2,
          borderWidth,
          borderColor,
          padding:      2,
          alignItems:     'center',
          justifyContent: 'center',
          shadowColor:   glowColor,
          shadowOffset:  { width: 0, height: 0 },
          shadowOpacity: hasGlow ? 1 : 0,
          shadowRadius:  frame ? frame.borderWidth * 4 : tier === 'galaxia' ? 12 : 6,
          elevation:     hasGlow ? 8 : 0,
        },
        pulses ? { opacity: pulse } : null,
        style,
      ]}
    >
      <Image
        source={{ uri: photoURL }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />

      {!frame && frameAsset && (
        <Image
          source={frameAsset as number}
          style={[StyleSheet.absoluteFill, { borderRadius: outer / 2 }]}
          resizeMode="cover"
        />
      )}

      {tier === 'galaxia' && (
        <View style={[styles.galaxiaBadge, {
          width:  size * 0.28,
          height: size * 0.28,
          bottom: 0,
          right:  0,
        }]}>
          <View style={styles.galaxiaBadgePlaceholder} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sceneWrap: {
    alignItems:     'center',
    justifyContent: 'center',
    shadowOffset:   { width: 0, height: 0 },
  },
  galaxiaBadge: {
    position:        'absolute',
    borderRadius:    999,
    backgroundColor: COLORS.primary,
    borderWidth:     2,
    borderColor:     COLORS.premium,
    alignItems:      'center',
    justifyContent:  'center',
    ...SHADOWS.premium,
  },
  galaxiaBadgePlaceholder: {
    width:           '60%',
    height:          '60%',
    borderRadius:    999,
    backgroundColor: COLORS.premium,
  },
});
// ============================================
// LUMINA — BADGE COMPONENT v2.0
// src/components/profile/Badge.tsx
//
// FASE 8 — redesenho premium.
//
// O que mudou da v1: cada badge agora tem CONTÊINER (anel de base
// com gradiente), TRÊS CAMADAS (fundo, forma, reflexo) e
// CONTORNO. Formas planas soltas não pareciam itens de coleção —
// e um item de 150 cristais precisa parecer caro antes de o
// usuário ler o preço.
//
// IDs de gradiente agora são únicos por instância: `genesisGrad`
// fixo na v1 colidia quando dois badges iguais apareciam na mesma
// tela, e o SVG resolvia o primeiro para os dois.
//
// O componente não conhece nomes de badge — recebe a aparência
// pronta (shape + cores + motion) e desenha.
// ============================================

import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, {
  Circle, Ellipse, Path, G, Defs, RadialGradient, LinearGradient,
  Stop, Line, Polygon, ClipPath, Rect,
} from 'react-native-svg';

export type BadgeShape =
  | 'spark' | 'orbit' | 'constellation' | 'tide'
  | 'meteor' | 'pulsar' | 'compass' | 'lighthouse'
  | 'wanderer' | 'greenhouse'
  | 'ice_ring' | 'stardust' | 'solar_crown'
  | 'crimson_nebula' | 'eclipse' | 'prism'
  | 'quasar' | 'singularity' | 'genesis' | 'milky_way';

export type BadgeMotion = 'none' | 'breathe' | 'rotate' | 'orbit_particles';

export interface BadgeAppearance {
  shape:       BadgeShape;
  coreColor:   string;
  accentColor: string;
  glowColor:   string;
  motion:      BadgeMotion;
}

interface BadgeProps {
  appearance: BadgeAppearance;
  size?:      number;
  dimmed?:    boolean;
}

const VB = 100;
const C  = VB / 2;

interface ShapeProps {
  core:   string;
  accent: string;
  uid:    string;  // sufixo para ids de gradiente únicos
}

// ── FRAGMENTOS — formas limpas, sem movimento ──

function ShapeSpark({ core, accent }: ShapeProps) {
  return (
    <G>
      <Path
        d={`M ${C} 20 L ${C + 7} ${C - 7} L ${C + 28} ${C} L ${C + 7} ${C + 7} L ${C} 80 L ${C - 7} ${C + 7} L ${C - 28} ${C} L ${C - 7} ${C - 7} Z`}
        fill={core} stroke={accent} strokeWidth={0.8} strokeOpacity={0.5}
      />
      <Circle cx={C} cy={C} r={5} fill={accent} />
      <Circle cx={C - 2} cy={C - 3} r={1.6} fill="#FFFFFF" opacity={0.85} />
    </G>
  );
}

function ShapeOrbit({ core, accent }: ShapeProps) {
  return (
    <G>
      <Ellipse cx={C} cy={C} rx={31} ry={13} stroke={core} strokeWidth={2.2}
               fill="none" opacity={0.85} />
      <Ellipse cx={C} cy={C} rx={31} ry={13} stroke={accent} strokeWidth={0.8}
               fill="none" opacity={0.5} transform={`rotate(24 ${C} ${C})`} />
      <Circle cx={C} cy={C} r={10} fill={core} stroke={accent} strokeWidth={1} />
      <Circle cx={C - 3} cy={C - 3} r={3} fill="#FFFFFF" opacity={0.3} />
      <Circle cx={C + 31} cy={C} r={4} fill={accent} />
    </G>
  );
}

function ShapeConstellation({ core, accent }: ShapeProps) {
  const pts = [
    { x: 28, y: 36 }, { x: 44, y: 24 }, { x: 60, y: 40 },
    { x: 71, y: 60 }, { x: 42, y: 70 },
  ];
  return (
    <G>
      {pts.slice(0, -1).map((p, i) => (
        <Line key={i} x1={p.x} y1={p.y} x2={pts[i + 1].x} y2={pts[i + 1].y}
              stroke={accent} strokeWidth={1.2} opacity={0.45} />
      ))}
      {pts.map((p, i) => (
        <G key={i}>
          <Circle cx={p.x} cy={p.y} r={i === 1 ? 7 : 5} fill={accent} opacity={0.18} />
          <Circle cx={p.x} cy={p.y} r={i === 1 ? 4 : 2.8} fill={core} />
        </G>
      ))}
    </G>
  );
}

function ShapeTide({ core, accent, uid }: ShapeProps) {
  return (
    <G>
      <Defs>
        <ClipPath id={`tideClip${uid}`}>
          <Circle cx={C} cy={C} r={30} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#tideClip${uid})`}>
        <Rect x={0} y={C} width={VB} height={VB} fill={core} opacity={0.35} />
        <Path d={`M 20 ${C} Q 35 ${C - 8} 50 ${C} T 80 ${C} L 80 80 L 20 80 Z`}
              fill={core} opacity={0.6} />
        <Path d={`M 20 ${C + 9} Q 35 ${C + 1} 50 ${C + 9} T 80 ${C + 9} L 80 80 L 20 80 Z`}
              fill={accent} opacity={0.35} />
      </G>
      <Circle cx={C} cy={C} r={30} stroke={accent} strokeWidth={1.5}
              fill="none" opacity={0.5} />
      <Circle cx={C + 12} cy={C - 15} r={4} fill={accent} opacity={0.7} />
    </G>
  );
}

// ── RARE ──

function ShapeMeteor({ core, accent, uid }: ShapeProps) {
  return (
    <G>
      <Defs>
        <LinearGradient id={`meteorGrad${uid}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%"   stopColor={core}   stopOpacity="0.9" />
          <Stop offset="100%" stopColor={accent} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d="M 72 24 L 26 72" stroke={`url(#meteorGrad${uid})`} strokeWidth={13}
            strokeLinecap="round" />
      <Path d="M 72 24 L 40 58" stroke={accent} strokeWidth={4.5}
            strokeLinecap="round" opacity={0.65} />
      <Circle cx={72} cy={24} r={12} fill={core} opacity={0.25} />
      <Circle cx={72} cy={24} r={8}  fill={core} stroke={accent} strokeWidth={1} />
      <Circle cx={70} cy={22} r={2.5} fill="#FFFFFF" opacity={0.8} />
    </G>
  );
}

function ShapePulsar({ core, accent }: ShapeProps) {
  return (
    <G>
      <Circle cx={C} cy={C} r={31} stroke={accent} strokeWidth={1.2} fill="none" opacity={0.22} />
      <Circle cx={C} cy={C} r={23} stroke={accent} strokeWidth={1.8} fill="none" opacity={0.45} />
      <Circle cx={C} cy={C} r={15} stroke={accent} strokeWidth={2.4} fill="none" opacity={0.75} />
      <Circle cx={C} cy={C} r={9}  fill={core} stroke={accent} strokeWidth={1} />
      <Circle cx={C - 2.5} cy={C - 2.5} r={3} fill="#FFFFFF" opacity={0.5} />
    </G>
  );
}

function ShapeCompass({ core, accent }: ShapeProps) {
  return (
    <G>
      <Circle cx={C} cy={C} r={29} stroke={core} strokeWidth={2.5} fill="none" />
      <Circle cx={C} cy={C} r={29} stroke={accent} strokeWidth={0.8} fill="none"
              opacity={0.4} strokeDasharray="2 6" />
      {[0, 90, 180, 270].map(deg => (
        <Line key={deg} x1={C} y1={C - 29} x2={C} y2={C - 23}
              stroke={accent} strokeWidth={2} transform={`rotate(${deg} ${C} ${C})`} />
      ))}
      {/* Agulha apontando — norte no core, sul apagado */}
      <Polygon points={`${C},${C - 20} ${C + 6},${C} ${C},${C + 4} ${C - 6},${C}`}
               fill={core} />
      <Polygon points={`${C},${C + 20} ${C + 6},${C} ${C},${C - 4} ${C - 6},${C}`}
               fill={accent} opacity={0.4} />
      <Circle cx={C} cy={C} r={3} fill={accent} />
    </G>
  );
}

function ShapeLighthouse({ core, accent, uid }: ShapeProps) {
  return (
    <G>
      <Defs>
        <LinearGradient id={`beamGrad${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%"   stopColor={core} stopOpacity="0.55" />
          <Stop offset="100%" stopColor={core} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {/* Feixes para os dois lados */}
      <Path d={`M ${C} ${C - 6} L 8 ${C - 22} L 8 ${C + 10} Z`} fill={`url(#beamGrad${uid})`} />
      <Path d={`M ${C} ${C - 6} L 92 ${C - 22} L 92 ${C + 10} Z`} fill={`url(#beamGrad${uid})`} />
      {/* Torre */}
      <Path d={`M ${C - 8} 78 L ${C - 5} ${C + 2} L ${C + 5} ${C + 2} L ${C + 8} 78 Z`}
            fill={accent} opacity={0.9} stroke={core} strokeWidth={0.8} />
      <Rect x={C - 7} y={C + 10} width={14} height={4} fill={core} opacity={0.5} />
      {/* Lanterna */}
      <Circle cx={C} cy={C - 6} r={9} fill={core} opacity={0.3} />
      <Circle cx={C} cy={C - 6} r={5.5} fill={core} stroke={accent} strokeWidth={1} />
    </G>
  );
}

function ShapeWanderer({ core, accent }: ShapeProps) {
  return (
    <G>
      {/* Pegadas que se afastam e somem */}
      {[
        { x: 30, y: 66, r: 5.5, o: 0.9 },
        { x: 42, y: 58, r: 4.5, o: 0.7 },
        { x: 53, y: 49, r: 3.8, o: 0.5 },
        { x: 63, y: 41, r: 3,   o: 0.34 },
        { x: 71, y: 34, r: 2.3, o: 0.2 },
      ].map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={p.r} fill={core} opacity={p.o} />
      ))}
      <Path d="M 26 72 Q 50 50 78 28" stroke={accent} strokeWidth={1}
            fill="none" opacity={0.3} strokeDasharray="3 5" />
      <Circle cx={76} cy={30} r={3} fill={accent} opacity={0.5} />
    </G>
  );
}

function ShapeGreenhouse({ core, accent }: ShapeProps) {
  return (
    <G>
      {/* Cúpula de vidro */}
      <Path d={`M ${C - 28} 72 L ${C - 28} ${C} Q ${C} ${C - 34} ${C + 28} ${C} L ${C + 28} 72 Z`}
            fill={accent} opacity={0.12} stroke={accent} strokeWidth={1.4} />
      <Line x1={C} y1={C - 26} x2={C} y2={72} stroke={accent} strokeWidth={0.8} opacity={0.35} />
      <Line x1={C - 28} y1={C + 8} x2={C + 28} y2={C + 8}
            stroke={accent} strokeWidth={0.8} opacity={0.35} />
      {/* Broto dentro */}
      <Path d={`M ${C} 72 L ${C} ${C + 4}`} stroke={core} strokeWidth={2.5} strokeLinecap="round" />
      <Path d={`M ${C} ${C + 8} Q ${C - 13} ${C + 2} ${C - 9} ${C + 14}`}
            fill={core} opacity={0.85} />
      <Path d={`M ${C} ${C + 4} Q ${C + 13} ${C - 2} ${C + 9} ${C + 10}`}
            fill={core} opacity={0.85} />
    </G>
  );
}

// ── EPIC ──

function ShapeIceRing({ core, accent }: ShapeProps) {
  return (
    <G>
      <Circle cx={C} cy={C} r={29} stroke={core} strokeWidth={4.5} fill="none" opacity={0.9} />
      <Circle cx={C} cy={C} r={29} stroke="#FFFFFF" strokeWidth={1.2} fill="none"
              opacity={0.55} strokeDasharray="5 11" />
      <Circle cx={C} cy={C} r={22} stroke={accent} strokeWidth={0.8} fill="none" opacity={0.3} />
      {/* Facetas de gelo */}
      {[20, 140, 260].map(deg => (
        <Polygon key={deg} points={`${C},${C - 33} ${C + 4},${C - 27} ${C},${C - 24} ${C - 4},${C - 27}`}
                 fill="#FFFFFF" opacity={0.6} transform={`rotate(${deg} ${C} ${C})`} />
      ))}
      <Circle cx={C} cy={C} r={11} fill={core} opacity={0.2} />
    </G>
  );
}

function ShapeStardust({ core, accent, uid }: ShapeProps) {
  const dots: [number, number, number][] = [
    [30, 32, 3.5], [46, 24, 2.2], [62, 34, 3], [70, 50, 1.8],
    [58, 66, 3.5], [40, 70, 2.2], [26, 54, 2.6], [50, 48, 5.5],
    [36, 46, 1.6], [66, 58, 1.8],
  ];
  return (
    <G>
      <Defs>
        <RadialGradient id={`dustGrad${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={accent} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={accent} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C} r={34} fill={`url(#dustGrad${uid})`} />
      {dots.map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill={i === 7 ? accent : core}
                opacity={i === 7 ? 1 : 0.8} />
      ))}
      <Circle cx={50} cy={48} r={9} fill={accent} opacity={0.2} />
    </G>
  );
}

function ShapeSolarCrown({ core, accent, uid }: ShapeProps) {
  const rays = Array.from({ length: 16 }, (_, i) => (i * 360) / 16);
  return (
    <G>
      <Defs>
        <RadialGradient id={`crownGrad${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="55%" stopColor={accent} stopOpacity="0" />
          <Stop offset="75%" stopColor={accent} stopOpacity="0.45" />
          <Stop offset="100%" stopColor={accent} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C} r={40} fill={`url(#crownGrad${uid})`} />
      {rays.map((deg, i) => (
        <Path key={i}
              d={`M ${C} 12 L ${C - 2.5} 30 L ${C + 2.5} 30 Z`}
              fill={accent} opacity={i % 2 === 0 ? 0.85 : 0.4}
              transform={`rotate(${deg} ${C} ${C})`} />
      ))}
      <Circle cx={C} cy={C} r={23} fill={core} />
      <Circle cx={C} cy={C} r={23} stroke={accent} strokeWidth={1.8} fill="none" opacity={0.8} />
    </G>
  );
}

function ShapeCrimsonNebula({ core, accent, uid }: ShapeProps) {
  return (
    <G>
      <Defs>
        <RadialGradient id={`nebGrad${uid}`} cx="45%" cy="45%" r="55%">
          <Stop offset="0%"   stopColor={accent} stopOpacity="0.75" />
          <Stop offset="60%"  stopColor={core}   stopOpacity="0.45" />
          <Stop offset="100%" stopColor={core}   stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C} r={38} fill={`url(#nebGrad${uid})`} />
      <Ellipse cx={C - 7} cy={C - 4} rx={24} ry={19} fill={core} opacity={0.28}
               transform={`rotate(-20 ${C} ${C})`} />
      <Ellipse cx={C + 8} cy={C + 6} rx={20} ry={16} fill={accent} opacity={0.22}
               transform={`rotate(15 ${C} ${C})`} />
      {[[C - 14, C - 12, 2.2], [C + 16, C + 4, 1.8], [C + 2, C + 17, 2],
        [C - 6, C + 8, 1.4], [C + 10, C - 14, 1.6]].map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" opacity={0.85} />
      ))}
    </G>
  );
}

function ShapeEclipse({ core, accent, uid }: ShapeProps) {
  return (
    <G>
      <Defs>
        <RadialGradient id={`eclGrad${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="58%" stopColor={accent} stopOpacity="0" />
          <Stop offset="66%" stopColor={accent} stopOpacity="0.85" />
          <Stop offset="100%" stopColor={accent} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C} r={42} fill={`url(#eclGrad${uid})`} />
      <Circle cx={C} cy={C} r={25} fill={core} />
      <Circle cx={C} cy={C} r={25} stroke={accent} strokeWidth={1.5} fill="none" opacity={0.9} />
      {/* Fulgor escapando num ponto */}
      <Circle cx={C + 18} cy={C - 17} r={4.5} fill={accent} opacity={0.9} />
      <Circle cx={C + 18} cy={C - 17} r={8} fill={accent} opacity={0.25} />
    </G>
  );
}

function ShapePrism({ core, accent, uid }: ShapeProps) {
  return (
    <G>
      <Defs>
        <LinearGradient id={`prismGrad${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.9" />
          <Stop offset="50%"  stopColor={core}    stopOpacity="0.7" />
          <Stop offset="100%" stopColor={accent}  stopOpacity="0.6" />
        </LinearGradient>
      </Defs>
      {/* Cristal facetado */}
      <Polygon points={`${C},18 ${C + 22},${C - 8} ${C + 14},${C + 26} ${C - 14},${C + 26} ${C - 22},${C - 8}`}
               fill={`url(#prismGrad${uid})`} stroke={accent} strokeWidth={1.2} />
      <Line x1={C} y1={18} x2={C} y2={C + 26} stroke="#FFFFFF" strokeWidth={0.8} opacity={0.5} />
      <Line x1={C - 22} y1={C - 8} x2={C} y2={C + 26} stroke="#FFFFFF" strokeWidth={0.6} opacity={0.35} />
      <Line x1={C + 22} y1={C - 8} x2={C} y2={C + 26} stroke="#FFFFFF" strokeWidth={0.6} opacity={0.35} />
      <Polygon points={`${C},18 ${C + 22},${C - 8} ${C},${C - 2} ${C - 22},${C - 8}`}
               fill="#FFFFFF" opacity={0.22} />
    </G>
  );
}

// ── LEGENDARY ──

function ShapeQuasar({ core, accent, uid }: ShapeProps) {
  return (
    <G>
      <Defs>
        <LinearGradient id={`jetGrad${uid}`} x1="50%" y1="50%" x2="50%" y2="0%">
          <Stop offset="0%"   stopColor={core}   stopOpacity="0.9" />
          <Stop offset="100%" stopColor={accent} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={`M ${C} ${C} L ${C - 8} 6 L ${C + 8} 6 Z`} fill={`url(#jetGrad${uid})`} />
      <Path d={`M ${C} ${C} L ${C - 8} 94 L ${C + 8} 94 Z`} fill={`url(#jetGrad${uid})`}
            transform={`rotate(180 ${C} ${C})`} />
      <Ellipse cx={C} cy={C} rx={33} ry={10} fill={accent} opacity={0.35} />
      <Ellipse cx={C} cy={C} rx={33} ry={10} stroke={accent} strokeWidth={1.5}
               fill="none" opacity={0.7} />
      <Circle cx={C} cy={C} r={16} fill={accent} opacity={0.3} />
      <Circle cx={C} cy={C} r={10} fill={core} />
      <Circle cx={C - 3} cy={C - 3} r={3} fill="#FFFFFF" opacity={0.6} />
    </G>
  );
}

function ShapeSingularity({ core, accent, uid }: ShapeProps) {
  return (
    <G>
      <Defs>
        <RadialGradient id={`singGrad${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="30%" stopColor={accent} stopOpacity="0" />
          <Stop offset="55%" stopColor={accent} stopOpacity="0.5" />
          <Stop offset="100%" stopColor={accent} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C} r={44} fill={`url(#singGrad${uid})`} />
      <Ellipse cx={C} cy={C} rx={38} ry={12} stroke={accent} strokeWidth={3}
               fill="none" opacity={0.9} />
      <Ellipse cx={C} cy={C} rx={30} ry={9} stroke={accent} strokeWidth={1.8}
               fill="none" opacity={0.6} />
      <Ellipse cx={C} cy={C} rx={22} ry={6.5} stroke={accent} strokeWidth={1.2}
               fill="none" opacity={0.4} />
      <Circle cx={C} cy={C} r={15} fill={core} />
      <Circle cx={C} cy={C} r={15} stroke={accent} strokeWidth={1.2} fill="none" opacity={0.95} />
    </G>
  );
}

function ShapeGenesis({ core, accent, uid }: ShapeProps) {
  const rays = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);
  return (
    <G>
      <Defs>
        <RadialGradient id={`genGrad${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={core}   stopOpacity="1" />
          <Stop offset="45%"  stopColor={accent} stopOpacity="0.55" />
          <Stop offset="100%" stopColor={accent} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C} r={44} fill={`url(#genGrad${uid})`} />
      {rays.map((deg, i) => (
        <Path key={i} d={`M ${C} ${C} L ${C - 2} 12 L ${C + 2} 12 Z`}
              fill={core} opacity={i % 2 === 0 ? 0.85 : 0.45}
              transform={`rotate(${deg} ${C} ${C})`} />
      ))}
      <Circle cx={C} cy={C} r={13} fill={core} opacity={0.35} />
      <Circle cx={C} cy={C} r={8}  fill="#FFFFFF" />
    </G>
  );
}

function ShapeMilkyWay({ core, accent, uid }: ShapeProps) {
  const stars: [number, number, number][] = [
    [22, 44, 1.4], [32, 34, 1.8], [44, 28, 1.2], [58, 30, 1.6],
    [70, 40, 1.3], [76, 54, 1.7], [66, 66, 1.4], [52, 72, 1.8],
    [38, 68, 1.2], [26, 58, 1.5], [62, 46, 1.1], [40, 52, 1.3],
  ];
  return (
    <G>
      <Defs>
        <RadialGradient id={`mwGrad${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={core}   stopOpacity="0.9" />
          <Stop offset="35%"  stopColor={accent} stopOpacity="0.4" />
          <Stop offset="100%" stopColor={accent} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={C} cy={C} r={44} fill={`url(#mwGrad${uid})`} />
      {/* Braços espirais */}
      <Path d={`M ${C} ${C} Q ${C + 26} ${C - 16} ${C + 20} ${C + 20}`}
            stroke={accent} strokeWidth={5} fill="none" opacity={0.3} strokeLinecap="round" />
      <Path d={`M ${C} ${C} Q ${C - 26} ${C + 16} ${C - 20} ${C - 20}`}
            stroke={accent} strokeWidth={5} fill="none" opacity={0.3} strokeLinecap="round" />
      {stars.map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" opacity={0.85} />
      ))}
      <Circle cx={C} cy={C} r={9} fill={core} opacity={0.5} />
      <Circle cx={C} cy={C} r={5} fill="#FFFFFF" />
    </G>
  );
}

const SHAPES: Record<BadgeShape, React.FC<ShapeProps>> = {
  spark:          ShapeSpark,
  orbit:          ShapeOrbit,
  constellation:  ShapeConstellation,
  tide:           ShapeTide,
  meteor:         ShapeMeteor,
  pulsar:         ShapePulsar,
  compass:        ShapeCompass,
  lighthouse:     ShapeLighthouse,
  wanderer:       ShapeWanderer,
  greenhouse:     ShapeGreenhouse,
  ice_ring:       ShapeIceRing,
  stardust:       ShapeStardust,
  solar_crown:    ShapeSolarCrown,
  crimson_nebula: ShapeCrimsonNebula,
  eclipse:        ShapeEclipse,
  prism:          ShapePrism,
  quasar:         ShapeQuasar,
  singularity:    ShapeSingularity,
  genesis:        ShapeGenesis,
  milky_way:      ShapeMilkyWay,
};

// Formas em que girar a peça inteira fica esquisito: bússola,
// farol e cristal têm orientação própria. Nelas o `rotate` do
// catálogo é tratado como `breathe`.
const NO_SPIN: BadgeShape[] = ['compass', 'lighthouse', 'prism', 'greenhouse', 'tide'];

let idCounter = 0;

export function Badge({ appearance, size = 64, dimmed = false }: BadgeProps) {
  const { shape, coreColor, accentColor, glowColor, motion } = appearance;
  const Shape = SHAPES[shape] ?? ShapeSpark;

  // Sufixo estável por instância: sem ele, dois badges iguais na
  // mesma tela compartilham o id do gradiente e o segundo herda o
  // do primeiro.
  const uid = useMemo(() => `b${(idCounter++).toString(36)}`, []);

  const spin    = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(1)).current;

  const spins = (motion === 'rotate' || motion === 'orbit_particles')
    && !NO_SPIN.includes(shape);
  const pulses = motion === 'breathe'
    || motion === 'orbit_particles'
    || ((motion === 'rotate') && NO_SPIN.includes(shape));

  useEffect(() => {
    if (!spins) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: motion === 'orbit_particles' ? 11000 : 16000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spins, motion]);

  useEffect(() => {
    if (!pulses) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 0.62, duration: 1700, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1,    duration: 1700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulses]);

  const rotation = spin.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          width:  size,
          height: size,
          shadowColor:   glowColor,
          shadowRadius:  size * 0.2,
          shadowOpacity: dimmed ? 0 : 1,
          elevation:     dimmed ? 0 : 7,
          opacity:       dimmed ? 0.4 : 1,
        },
      ]}
    >
      {/* Contêiner: anel de base comum a todos, o que faz os
          badges lerem como coleção em vez de formas soltas. */}
      <Svg
        width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient id={`base${uid}`} cx="50%" cy="38%" r="62%">
            <Stop offset="0%"   stopColor="#2A2438" stopOpacity="0.95" />
            <Stop offset="100%" stopColor="#0A0A14" stopOpacity="1" />
          </RadialGradient>
          <LinearGradient id={`ring${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%"   stopColor={accentColor} stopOpacity="0.9" />
            <Stop offset="100%" stopColor={coreColor}   stopOpacity="0.35" />
          </LinearGradient>
        </Defs>
        <Circle cx={C} cy={C} r={47} fill={`url(#base${uid})`} />
        <Circle cx={C} cy={C} r={47} stroke={`url(#ring${uid})`} strokeWidth={2.5} fill="none" />
        {/* Reflexo superior — o que dá a leitura de peça física */}
        <Path d={`M ${C - 30} ${C - 26} Q ${C} ${C - 44} ${C + 30} ${C - 26}`}
              stroke="#FFFFFF" strokeWidth={1.6} fill="none" opacity={0.16} />
      </Svg>

      {/* Forma, com o pulso e a rotação aplicados só nela */}
      <Animated.View
        style={[
          spins  ? { transform: [{ rotate: rotation }] } : null,
          pulses ? { opacity: breathe } : null,
        ]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
          <Shape core={coreColor} accent={accentColor} uid={uid} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems:     'center',
    justifyContent: 'center',
    shadowOffset:   { width: 0, height: 0 },
  },
});
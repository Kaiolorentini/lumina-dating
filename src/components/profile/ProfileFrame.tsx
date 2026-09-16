// ============================================
// LUMINA — PROFILE FRAME v4.0
// src/components/profile/ProfileFrame.tsx
//
// FASE 8 — a moldura virou o UNIVERSO do card.
//
// v3 desenhava uma cena quadrada com a foto no meio, e sobrava
// cinza em volta dentro do card. Agora a cena tem viewBox
// RETANGULAR e preenche toda a área da foto, com fundo próprio:
// cada moldura define a atmosfera do card inteiro.
//
// ZONA SEGURA: nada abaixo do raio 36 (num viewBox de altura
// 100). A foto cobre o centro, e na v3 metade do desenho de
// várias cenas ficava escondida atrás dela — as elipses internas
// do buraco negro não apareciam nunca.
//
// CORTE POR TAMANHO: abaixo de 80px a cena vira borrão, então
// cai para anel simples. Preserva os usos em 26px e 40px.
// ============================================

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Image, StyleSheet, ViewStyle, Animated, Easing } from 'react-native';
import Svg, {
  Circle, Ellipse, Path, G, Defs, RadialGradient, LinearGradient,
  Stop, Rect, ClipPath,
} from 'react-native-svg';
import { COLORS, TIER_COLORS, TIER_GLOW, SHADOWS } from '../../theme/tokens';
import { getFrameAsset } from '../../assets';

type Tier = 'comum' | 'raro' | 'epico' | 'lendario' | 'galaxia';

export type FrameScene =
  | 'nebulosa' | 'eclipse' | 'maresia' | 'supernova'
  | 'aurora' | 'cometa' | 'buraco_negro' | 'via_lactea'
  | 'conquista' | 'forja';

export interface FrameAppearance {
  borderColor: string;
  glowColor:   string;
  borderWidth: number;
  animated:    boolean;
  scene?:      FrameScene;
}

interface ProfileFrameProps {
  photoURL:   string;
  tier?:      Tier;
  frame?:     FrameAppearance | null;
  size?:      number;   // largura; a altura segue `ratio`
  /** altura / largura. 1 = quadrado. O card do feed usa 1.15. */
  ratio?:     number;
  /** false desenha SÓ a cena, sem a foto no centro. Usado quando
   *  a tela já tem a própria foto por cima — o perfil aberto põe
   *  a moldura como fundo da imagem grande. */
  showPhoto?: boolean;
  style?:     ViewStyle;
}

// viewBox de largura 100 e altura 100*ratio. Tudo desenhado em
// coordenadas dessa grade.
const W = 100;
const SCENE_MIN_SIZE = 80;
/** A foto ocupa esta fração da LARGURA. */
const PHOTO_RATIO = 0.55;

interface SceneProps {
  border: string;
  glow:   string;
  uid:    string;
  h:      number;   // altura do viewBox
  cx:     number;   // centro x
  cy:     number;   // centro y
  safe:   number;   // raio da foto + respiro: nada desenhado dentro
}

// ── Fundo comum: gradiente radial escuro com a cor da moldura ──
function SceneBackdrop({ border, uid, h }: { border: string; uid: string; h: number }) {
  return (
    <>
      <Defs>
        <RadialGradient id={`bg${uid}`} cx="50%" cy="45%" r="75%">
          <Stop offset="0%"   stopColor={border}   stopOpacity="0.22" />
          <Stop offset="55%"  stopColor="#14101F"  stopOpacity="0.95" />
          <Stop offset="100%" stopColor="#08060F"  stopOpacity="1" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={W} height={h} fill={`url(#bg${uid})`} />
    </>
  );
}

function SceneViaLactea({ border, uid, h, cx, cy, safe }: SceneProps) {
  // "Braços espirais e cem bilhões de estrelas" — 26 estrelas de
  // tamanhos irregulares, distribuídas fora do eixo. Simetria
  // perfeita leria como interface, não como céu.
  const stars: [number, number, number, number][] = [
    [10, 14, 1.4, 0.9], [24, 8, 0.9, 0.6], [38, 18, 1.7, 1], [52, 6, 1.1, 0.75],
    [68, 15, 1.3, 0.85], [84, 9, 0.8, 0.55], [92, 24, 1.5, 0.9], [78, 32, 1, 0.7],
    [94, 44, 1.2, 0.8], [88, 62, 1.6, 0.95], [96, 78, 0.9, 0.6], [80, 86, 1.4, 0.85],
    [64, 94, 1.1, 0.7], [48, 88, 1.8, 1], [32, 96, 0.9, 0.55], [16, 84, 1.3, 0.8],
    [6, 66, 1.5, 0.9], [12, 48, 1, 0.65], [4, 32, 1.2, 0.75], [28, 30, 0.8, 0.5],
    [72, 72, 1.1, 0.7], [20, 62, 0.9, 0.55], [86, 40, 0.7, 0.45], [40, 76, 1, 0.6],
    [58, 26, 0.8, 0.5], [34, 46, 0.7, 0.4],
  ];
  return (
    <G>
      <SceneBackdrop border={border} uid={uid} h={h} />
      {/* Braços assimétricos: um mais longo que os outros */}
      <Path d={`M ${cx + safe} ${cy} Q ${cx + 46} ${cy - 34} ${cx + 4} ${cy - 52}`}
            stroke={border} strokeWidth={7} fill="none" opacity={0.2} strokeLinecap="round" />
      <Path d={`M ${cx - safe} ${cy} Q ${cx - 42} ${cy + 30} ${cx - 2} ${cy + 46}`}
            stroke={border} strokeWidth={6} fill="none" opacity={0.16} strokeLinecap="round" />
      <Path d={`M ${cx} ${cy - safe} Q ${cx + 34} ${cy - 38} ${cx + 44} ${cy + 6}`}
            stroke={border} strokeWidth={4.5} fill="none" opacity={0.12} strokeLinecap="round" />
      {stars.map(([x, y, r, o], i) => (
        <Circle key={i} cx={x} cy={y * (h / 100)} r={r} fill="#FFFFFF" opacity={o} />
      ))}
    </G>
  );
}

function SceneBuracoNegro({ border, uid, h, cx, cy, safe }: SceneProps) {
  // "Um disco de acreção girando em torno do nada" — o disco tem
  // brilho ASSIMÉTRICO: mais intenso de um lado, como o material
  // que vem na nossa direção. Na v3 as elipses internas ficavam
  // inteiras atrás da foto.
  return (
    <G>
      <SceneBackdrop border="#2A1A00" uid={uid} h={h} />
      <Defs>
        <LinearGradient id={`disk${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%"   stopColor="#FFD700" stopOpacity="0.2" />
          <Stop offset="35%"  stopColor="#FFF0B0" stopOpacity="1" />
          <Stop offset="65%"  stopColor="#FFD700" stopOpacity="0.85" />
          <Stop offset="100%" stopColor="#FF8A00" stopOpacity="0.25" />
        </LinearGradient>
      </Defs>
      <Ellipse cx={cx} cy={cy} rx={48} ry={17} stroke={`url(#disk${uid})`}
               strokeWidth={9} fill="none" />
      <Ellipse cx={cx} cy={cy} rx={48} ry={17} stroke="#FFF6D0"
               strokeWidth={1.5} fill="none" opacity={0.6} />
      <Ellipse cx={cx} cy={cy} rx={safe + 6} ry={safe * 0.32} stroke="#FFD700"
               strokeWidth={2.5} fill="none" opacity={0.45} />
      {/* Luz curvando por cima do horizonte */}
      <Path d={`M ${cx - 44} ${cy - 4} Q ${cx} ${cy - safe - 22} ${cx + 44} ${cy - 4}`}
            stroke="#FFE9A8" strokeWidth={2.5} fill="none" opacity={0.55} />
      <Path d={`M ${cx - 38} ${cy + 6} Q ${cx} ${cy + safe + 16} ${cx + 38} ${cy + 6}`}
            stroke="#FFAA33" strokeWidth={1.5} fill="none" opacity={0.3} />
    </G>
  );
}

function SceneSupernova({ border, uid, h, cx, cy, safe }: SceneProps) {
  const rays = Array.from({ length: 28 }, (_, i) => (i * 360) / 28);
  return (
    <G>
      <SceneBackdrop border={border} uid={uid} h={h} />
      <Defs>
        <RadialGradient id={`sn${uid}`} cx="50%" cy="50%" r="55%">
          <Stop offset="30%" stopColor={border} stopOpacity="0.55" />
          <Stop offset="60%" stopColor={border} stopOpacity="0.2" />
          <Stop offset="100%" stopColor={border} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={60} fill={`url(#sn${uid})`} />
      {/* Raios de comprimento irregular — explosão não é simétrica */}
      {rays.map((deg, i) => {
        const len = i % 4 === 0 ? 56 : i % 3 === 0 ? 48 : 42;
        return (
          <Path key={i}
                d={`M ${cx} ${cy - safe - 3} L ${cx - 1.6} ${cy - len} L ${cx + 1.6} ${cy - len} Z`}
                fill={border} opacity={i % 4 === 0 ? 0.75 : i % 2 === 0 ? 0.45 : 0.22}
                transform={`rotate(${deg} ${cx} ${cy})`} />
        );
      })}
      <Circle cx={cx} cy={cy} r={safe + 10} stroke={border} strokeWidth={2.5}
              fill="none" opacity={0.55} />
      <Circle cx={cx} cy={cy} r={safe + 20} stroke={border} strokeWidth={1.2}
              fill="none" opacity={0.28} />
      {/* Detritos */}
      {[[cx - 40, cy - 28], [cx + 36, cy - 34], [cx + 42, cy + 24], [cx - 34, cy + 32]].map(
        ([x, y], i) => <Circle key={i} cx={x} cy={y} r={1.8} fill="#FFFFFF" opacity={0.7} />
      )}
    </G>
  );
}

function SceneAurora({ border, uid, h, cx, cy, safe }: SceneProps) {
  // "Cortinas de verde e rosa dançando no polo" — cortinas com
  // ondulação real, alturas diferentes, duas cores.
  const curtains = [
    { x: 8,  w: 9,  o: 0.5,  c: border },
    { x: 20, w: 6,  o: 0.32, c: '#FF8FD4' },
    { x: 30, w: 11, o: 0.55, c: border },
    { x: 70, w: 10, o: 0.5,  c: border },
    { x: 82, w: 7,  o: 0.35, c: '#FF8FD4' },
    { x: 92, w: 8,  o: 0.42, c: border },
  ];
  return (
    <G>
      <SceneBackdrop border={border} uid={uid} h={h} />
      <Defs>
        <LinearGradient id={`au${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <Stop offset="0%"   stopColor={border} stopOpacity="0" />
          <Stop offset="40%"  stopColor={border} stopOpacity="0.85" />
          <Stop offset="100%" stopColor={border} stopOpacity="0.1" />
        </LinearGradient>
      </Defs>
      {curtains.map((c, i) => (
        <Path key={i}
              d={`M ${c.x} ${h * 0.92} Q ${c.x + 8} ${h * 0.55} ${c.x - 5} ${h * 0.28} T ${c.x + 3} ${h * 0.06}`}
              stroke={c.c} strokeWidth={c.w} fill="none"
              opacity={c.o} strokeLinecap="round" />
      ))}
      {/* Brilho de horizonte na base */}
      <Ellipse cx={cx} cy={h * 0.97} rx={54} ry={9} fill={border} opacity={0.2} />
    </G>
  );
}

function SceneCometa({ border, uid, h, cx, cy, safe }: SceneProps) {
  const orbit = safe + 18;
  return (
    <G>
      <SceneBackdrop border={border} uid={uid} h={h} />
      <Defs>
        <LinearGradient id={`tail${uid}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.95" />
          <Stop offset="35%"  stopColor={border}  stopOpacity="0.6" />
          <Stop offset="100%" stopColor={border}  stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={orbit} stroke={border} strokeWidth={0.8}
              fill="none" opacity={0.2} strokeDasharray="2 8" />
      {/* Cauda ao longo de três quartos da órbita */}
      <Path d={`M ${cx + orbit} ${cy} A ${orbit} ${orbit} 0 1 0 ${cx} ${cy + orbit}`}
            stroke={`url(#tail${uid})`} strokeWidth={13}
            fill="none" strokeLinecap="round" />
      <Path d={`M ${cx + orbit} ${cy} A ${orbit} ${orbit} 0 0 0 ${cx - orbit * 0.5} ${cy - orbit * 0.87}`}
            stroke="#FFFFFF" strokeWidth={3} fill="none"
            opacity={0.45} strokeLinecap="round" />
      {/* Partículas se soltando */}
      {[[cx + orbit - 6, cy - 12], [cx + orbit - 16, cy - 22], [cx + orbit + 7, cy + 9]].map(
        ([x, y], i) => <Circle key={i} cx={x} cy={y} r={1.5} fill={border} opacity={0.7} />
      )}
      <Circle cx={cx + orbit} cy={cy} r={13} fill={border} opacity={0.25} />
      <Circle cx={cx + orbit} cy={cy} r={7}  fill="#FFFFFF" />
    </G>
  );
}

function SceneNebulosa({ border, uid, h, cx, cy, safe }: SceneProps) {
  return (
    <G>
      <SceneBackdrop border={border} uid={uid} h={h} />
      <Defs>
        <RadialGradient id={`nbA${uid}`} cx="35%" cy="35%" r="60%">
          <Stop offset="0%"   stopColor={border} stopOpacity="0.45" />
          <Stop offset="100%" stopColor={border} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`nbB${uid}`} cx="70%" cy="65%" r="55%">
          <Stop offset="0%"   stopColor="#E0CCFF" stopOpacity="0.3" />
          <Stop offset="100%" stopColor="#E0CCFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {/* Nuvens sobrepostas, fora de eixo */}
      <Ellipse cx={cx - 24} cy={cy - 30} rx={42} ry={30} fill={`url(#nbA${uid})`}
               transform={`rotate(-24 ${cx - 24} ${cy - 30})`} />
      <Ellipse cx={cx + 26} cy={cy + 26} rx={38} ry={28} fill={`url(#nbB${uid})`}
               transform={`rotate(18 ${cx + 26} ${cy + 26})`} />
      <Ellipse cx={cx + 20} cy={cy - 34} rx={26} ry={16} fill={border} opacity={0.14}
               transform={`rotate(40 ${cx + 20} ${cy - 34})`} />
      <Ellipse cx={cx - 28} cy={cy + 30} rx={24} ry={15} fill={border} opacity={0.12}
               transform={`rotate(-35 ${cx - 28} ${cy + 30})`} />
      {/* Estrelas nascendo */}
      {[[cx - 34, cy - 36], [cx + 30, cy - 40], [cx + 38, cy + 14], [cx - 40, cy + 20],
        [cx + 8, cy - 46], [cx - 12, cy + 44], [cx + 42, cy - 12]].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.2 : 1.4}
                fill="#FFFFFF" opacity={0.85} />
      ))}
    </G>
  );
}

function SceneEclipse({ border, uid, h, cx, cy, safe }: SceneProps) {
  const spikes = Array.from({ length: 40 }, (_, i) => (i * 360) / 40);
  return (
    <G>
      <SceneBackdrop border="#1A1608" uid={uid} h={h} />
      <Defs>
        <RadialGradient id={`cor${uid}`} cx="50%" cy="50%" r="55%">
          <Stop offset={`${(safe / 60) * 100}%`} stopColor="#FFE9A8" stopOpacity="0.85" />
          <Stop offset="72%" stopColor="#FFC24A" stopOpacity="0.3" />
          <Stop offset="100%" stopColor="#FFC24A" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={58} fill={`url(#cor${uid})`} />
      {/* Coroa irregular — filamentos de comprimentos variados */}
      {spikes.map((deg, i) => {
        const len = i % 5 === 0 ? 52 : i % 3 === 0 ? 46 : 41;
        return (
          <Path key={i} d={`M ${cx} ${cy - safe - 2} L ${cx} ${cy - len}`}
                stroke="#FFE9A8" strokeWidth={i % 5 === 0 ? 2 : 1}
                opacity={i % 5 === 0 ? 0.6 : 0.25}
                transform={`rotate(${deg} ${cx} ${cy})`} />
        );
      })}
      {/* Protuberância solar */}
      <Path d={`M ${cx + safe * 0.7} ${cy - safe * 0.7} q 10 -8 16 4`}
            stroke="#FF8A33" strokeWidth={3} fill="none" opacity={0.8} strokeLinecap="round" />
      <Circle cx={cx + safe * 0.7 + 16} cy={cy - safe * 0.7 + 4} r={6}
              fill="#FF8A33" opacity={0.25} />
    </G>
  );
}

function SceneMaresia({ border, uid, h, cx, cy, safe }: SceneProps) {
  return (
    <G>
      <SceneBackdrop border={border} uid={uid} h={h} />
      <Defs>
        <ClipPath id={`seaClip${uid}`}>
          <Rect x={0} y={0} width={W} height={h} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#seaClip${uid})`}>
        {/* Ondas concêntricas de espessura decrescente */}
        {[safe + 8, safe + 18, safe + 29, safe + 41, safe + 54].map((r, i) => (
          <Circle key={r} cx={cx} cy={cy} r={r} stroke={border}
                  strokeWidth={i === 0 ? 3 : 2.5 - i * 0.4}
                  fill="none" opacity={0.45 - i * 0.07} />
        ))}
        {/* Crista quebrando de um lado */}
        <Path d={`M ${cx - 46} ${cy + 14} Q ${cx - 20} ${cy + 2} ${cx - 48} ${cy - 10}`}
              stroke="#FFFFFF" strokeWidth={1.5} fill="none" opacity={0.25} />
      </G>
      {/* Reflexo de luar */}
      <Path d={`M ${cx - 26} ${cy - safe - 14} Q ${cx} ${cy - safe - 26} ${cx + 26} ${cy - safe - 14}`}
            stroke="#FFFFFF" strokeWidth={2.5} fill="none" opacity={0.35} />
      <Circle cx={cx + 34} cy={cy - safe - 20} r={4} fill="#FFFFFF" opacity={0.5} />
      <Circle cx={cx + 34} cy={cy - safe - 20} r={9} fill="#FFFFFF" opacity={0.12} />
    </G>
  );
}

function SceneConquista({ border, uid, h, cx, cy, safe }: SceneProps) {
  return (
    <G>
      <SceneBackdrop border={border} uid={uid} h={h} />
      <Circle cx={cx} cy={cy} r={safe + 8} stroke={border} strokeWidth={3}
              fill="none" opacity={0.85} />
      <Circle cx={cx} cy={cy} r={safe + 16} stroke={border} strokeWidth={1}
              fill="none" opacity={0.35} strokeDasharray="3 6" />
      {[0, 90, 180, 270].map(deg => (
        <Circle key={deg} cx={cx} cy={cy - safe - 8} r={3} fill={border}
                transform={`rotate(${deg} ${cx} ${cy})`} />
      ))}
    </G>
  );
}

function SceneForja({ border, uid, h, cx, cy, safe }: SceneProps) {
  // "Forja" — a moldura do criador. Fogo é o oposto do frio
  // cósmico das outras oito: quem produz queima por isso, e o
  // contraste faz a insígnia ser reconhecida de longe.
  //
  // Três camadas de temperatura, como fogo real: âmbar na base,
  // laranja no corpo, branco na ponta.
  const flames = [
    { x: cx - 38, w: 16, hgt: 0.54, o: 0.55, c: '#FF6A00' },
    { x: cx - 20, w: 13, hgt: 0.68, o: 0.7,  c: '#FF8A1F' },
    { x: cx,      w: 19, hgt: 0.82, o: 0.85, c: '#FFAA33' },
    { x: cx + 21, w: 14, hgt: 0.64, o: 0.7,  c: '#FF8A1F' },
    { x: cx + 39, w: 15, hgt: 0.5,  o: 0.5,  c: '#FF6A00' },
  ];
  // Brasas subindo, tamanhos e alturas irregulares.
  const embers: [number, number, number, number][] = [
    [cx - 44, h * 0.30, 1.8, 0.8], [cx - 26, h * 0.16, 1.2, 0.6],
    [cx - 8,  h * 0.10, 2.2, 0.9], [cx + 14, h * 0.20, 1.4, 0.7],
    [cx + 33, h * 0.12, 1.9, 0.75], [cx + 46, h * 0.26, 1.1, 0.5],
    [cx - 36, h * 0.06, 1.5, 0.65], [cx + 6,  h * 0.32, 1.3, 0.55],
  ];

  return (
    <G>
      <Defs>
        <RadialGradient id={`forjaBg${uid}`} cx="50%" cy="78%" r="80%">
          <Stop offset="0%"   stopColor="#FF6A00" stopOpacity="0.35" />
          <Stop offset="45%"  stopColor="#3A1206" stopOpacity="0.95" />
          <Stop offset="100%" stopColor="#120603" stopOpacity="1" />
        </RadialGradient>
        <LinearGradient id={`flame${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <Stop offset="0%"   stopColor="#FFC24A" stopOpacity="0.9" />
          <Stop offset="45%"  stopColor="#FF6A00" stopOpacity="0.75" />
          <Stop offset="100%" stopColor="#FFF0C0" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={W} height={h} fill={`url(#forjaBg${uid})`} />

      {/* Brasa incandescente na base */}
      <Ellipse cx={cx} cy={h * 0.95} rx={46} ry={8} fill="#FF6A00" opacity={0.45} />
      <Ellipse cx={cx} cy={h * 0.95} rx={28} ry={5} fill="#FFC24A" opacity={0.6} />

      {/* Línguas de fogo — curvas assimétricas, não triângulos */}
      {flames.map((f, i) => {
        const base = h * 0.94;
        const top  = base - h * f.hgt;
        const sway = i % 2 === 0 ? 9 : -7;
        return (
          <Path key={i}
                d={`M ${f.x - f.w / 2} ${base}
                    Q ${f.x - f.w / 2 + sway} ${(base + top) / 2} ${f.x + sway * 0.4} ${top}
                    Q ${f.x + f.w / 2 + sway * 0.6} ${(base + top) / 2} ${f.x + f.w / 2} ${base} Z`}
                fill={`url(#flame${uid})`} opacity={f.o} />
        );
      })}

      {/* Núcleo branco, a parte mais quente */}
      <Path d={`M ${cx - 7} ${h * 0.93}
                Q ${cx + 3} ${h * 0.62} ${cx} ${h * 0.44}
                Q ${cx - 4} ${h * 0.64} ${cx + 7} ${h * 0.93} Z`}
            fill="#FFF0C0" opacity={0.55} />

      {embers.map(([x, y, r, o], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill="#FFC24A" opacity={o} />
      ))}

      {/* Anel de forja em torno da foto, como metal aquecido */}
      <Circle cx={cx} cy={cy} r={safe + 5} stroke="#FF8A1F" strokeWidth={2.5}
              fill="none" opacity={0.7} />
      <Circle cx={cx} cy={cy} r={safe + 5} stroke="#FFF0C0" strokeWidth={0.8}
              fill="none" opacity={0.5} strokeDasharray="4 10" />
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
  forja:        SceneForja,
};

// Aurora e Maresia pulsam: cortina e onda girando ficam esquisitas.
const SPINNING: FrameScene[] = [
  'via_lactea', 'buraco_negro', 'cometa', 'nebulosa', 'eclipse', 'supernova',
];

let frameIdCounter = 0;

export function ProfileFrame({
  photoURL,
  tier      = 'comum',
  frame     = null,
  size      = 80,
  ratio     = 1,
  showPhoto = true,
  style,
}: ProfileFrameProps) {
  const frameAsset = getFrameAsset(tier);

  const borderColor = frame?.borderColor ?? TIER_COLORS[tier];
  const glowColor   = frame?.glowColor   ?? TIER_GLOW[tier];
  const borderWidth = frame
    ? frame.borderWidth
    : tier === 'comum' ? 0 : tier === 'galaxia' ? 3 : 2;

  const hasGlow   = frame !== null || tier !== 'comum';
  const showScene = frame?.scene !== undefined && size >= SCENE_MIN_SIZE;

  const uid = useMemo(() => `f${(frameIdCounter++).toString(36)}`, []);

  const spin  = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  const spins  = showScene && frame!.animated && SPINNING.includes(frame!.scene!);
  const pulses = frame?.animated && !spins;

  useEffect(() => {
    if (!spins) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1, duration: 30000,
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
        Animated.timing(pulse, { toValue: 0.55, duration: 2100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 2100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulses]);

  const rotation = spin.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── Cena preenchendo a área inteira ──
  if (showScene) {
    const Scene     = SCENES[frame!.scene!];
    const height    = size * ratio;
    const vbH       = W * ratio;
    const cx        = W / 2;
    const cy        = vbH / 2;
    const photoSize = size * PHOTO_RATIO;
    // Raio da foto na grade do viewBox, mais respiro.
    const safe      = (PHOTO_RATIO * W) / 2 + 6;

    return (
      <View
        style={[
          styles.sceneWrap,
          {
            width:  size,
            height,
            shadowColor:   glowColor,
            shadowRadius:  size * 0.12,
            shadowOpacity: 1,
            elevation:     8,
          },
          style,
        ]}
      >
        {/* A cena gira/pulsa; a foto fica parada por cima. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            spins  ? { transform: [{ rotate: rotation }] } : null,
            pulses ? { opacity: pulse } : null,
          ]}
        >
          <Svg width={size} height={height} viewBox={`0 0 ${W} ${vbH}`}>
            <Scene border={borderColor} glow={glowColor} uid={uid}
                   h={vbH} cx={cx} cy={cy} safe={safe} />
          </Svg>
        </Animated.View>

        {showPhoto && (
          <Image
            source={{ uri: photoURL }}
            style={{
              width:        photoSize,
              height:       photoSize,
              borderRadius: photoSize / 2,
              borderWidth:  2,
              borderColor,
            }}
            resizeMode="cover"
          />
        )}
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
    overflow:       'hidden',
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
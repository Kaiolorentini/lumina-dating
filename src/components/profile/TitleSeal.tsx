// ============================================
// LUMINA — SELOS DE TÍTULO
// src/components/profile/TitleSeal.tsx
//
// Substitui o TitleSymbol, que tinha DOIS problemas graves:
// 19 títulos para 14 formas — cinco pares desenhavam idêntico —
// e formas simples demais, que liam como ícone de interface
// em vez de insígnia.
//
// ── A LINGUAGEM ──
//
// Selo cósmico: um anel comum a todos, e dentro dele uma
// configuração astral ÚNICA por título. O anel é o que faz a
// coleção se ler como coleção; o interior é o que distingue.
//
// A hierarquia aparece na DENSIDADE, não no tamanho: títulos
// comuns têm o anel simples e poucos corpos; os míticos ganham
// o segundo anel, os raios externos e o interior cheio.
//
// Tudo numa grade de 48x48 — o dobro da anterior. Com 24 não
// cabia detalhe suficiente para parecer insígnia.
// ============================================

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, {
  Circle, Path, G, Ellipse, Defs, RadialGradient, Stop, Line,
} from 'react-native-svg';
import { TitleDef, TITLE_RARITY_COLOR } from '../../config/titlesCatalog';

const VB = 48;
const C  = VB / 2;

interface Props {
  title: TitleDef;
  size?: number;
  style?: ViewStyle;
}

let sealIdCounter = 0;

export function TitleSeal({ title, size = 26, style }: Props) {
  const color = TITLE_RARITY_COLOR[title.rarity];
  const uid   = React.useMemo(() => `seal${(sealIdCounter++).toString(36)}`, []);

  // Míticos e lendários ganham o segundo anel e os raios: é o
  // que separa a insígnia rara da comum à primeira vista.
  const grand = title.rarity === 'MYTHIC' || title.rarity === 'LEGENDARY';

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
        <Defs>
          <RadialGradient id={`core${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor={color} stopOpacity="0.35" />
            <Stop offset="70%"  stopColor={color} stopOpacity="0.08" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Halo interno — dá profundidade e evita que o
            interior flutue solto dentro do anel. */}
        <Circle cx={C} cy={C} r={19} fill={`url(#core${uid})`} />

        {/* ── ANEL COMUM ──
            O elemento que faz os 19 se lerem como família. */}
        <Circle cx={C} cy={C} r={21} stroke={color} strokeWidth={1.6} fill="none" opacity={0.9} />

        {grand && (
          <>
            <Circle cx={C} cy={C} r={23.2} stroke={color} strokeWidth={0.8} fill="none" opacity={0.55} />
            {/* Raios nos quatro pontos cardeais — coroa do selo */}
            {[0, 90, 180, 270].map(deg => (
              <Line
                key={deg}
                x1={C} y1={1.2} x2={C} y2={4.4}
                stroke={color} strokeWidth={1.8} strokeLinecap="round"
                transform={`rotate(${deg} ${C} ${C})`}
              />
            ))}
          </>
        )}

        {/* Marcas do anel: topo e base, como numa medalha. */}
        <Line x1={C} y1={26.4} x2={C} y2={21} stroke={color} strokeWidth={1.4}
              strokeLinecap="round" opacity={0.5}
              transform={`rotate(180 ${C} ${C})`} />
        <Line x1={C} y1={26.4} x2={C} y2={21} stroke={color} strokeWidth={1.4}
              strokeLinecap="round" opacity={0.5} />

        {renderInterior(title.shape, color)}
      </Svg>
    </View>
  );
}

/**
 * O interior de cada selo. Cada forma é uma configuração
 * astral distinta — nenhuma se repete entre os 19. O anel
 * externo é comum; é aqui que os títulos se distinguem.
 */
function renderInterior(shape: TitleDef['shape'], c: string) {
  switch (shape) {

    // ══ CONEXÃO ══

    // Conectado — dois corpos numa órbita compartilhada
    case 'elo':
      return (
        <G>
          <Ellipse cx={C} cy={C} rx={13} ry={6.5} stroke={c} strokeWidth={1.3}
                   fill="none" opacity={0.7} transform={`rotate(-20 ${C} ${C})`} />
          <Circle cx={C - 10} cy={C + 3.6} r={3.4} fill={c} />
          <Circle cx={C + 10} cy={C - 3.6} r={3.4} fill={c} />
        </G>
      );

    // Alma Social — conjunção tripla, três planos orbitais
    case 'elo_duplo':
      return (
        <G>
          {[0, 60, -60].map(deg => (
            <Ellipse key={deg} cx={C} cy={C} rx={14} ry={5} stroke={c} strokeWidth={1.2}
                     fill="none" opacity={0.6} transform={`rotate(${deg} ${C} ${C})`} />
          ))}
          <Circle cx={C} cy={C} r={4.2} fill={c} />
        </G>
      );

    // Alma Gêmea — sistema binário com ponte de matéria
    case 'elos_entrelacados':
      return (
        <G>
          <Ellipse cx={C} cy={C} rx={15} ry={9} stroke={c} strokeWidth={1.2}
                   fill="none" opacity={0.55} transform={`rotate(30 ${C} ${C})`} />
          <Circle cx={C - 8.5} cy={C - 5} r={5} fill={c} />
          <Circle cx={C + 8.5} cy={C + 5} r={5} fill={c} opacity={0.85} />
          <Path d={`M ${C - 5.5} ${C - 3.2} Q ${C} ${C} ${C + 5.5} ${C + 3.2}`}
                stroke={c} strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.9} />
        </G>
      );

    // ══ EXPLORAÇÃO ══

    // Explorador — rota traçada entre estrelas
    case 'estrela':
      return (
        <G>
          <Path d={`M ${C - 12} ${C + 8} L ${C - 4} ${C - 2} L ${C + 5} ${C + 3} L ${C + 12} ${C - 8}`}
                stroke={c} strokeWidth={1.3} fill="none" strokeLinecap="round"
                strokeDasharray="3 2.5" opacity={0.75} />
          <Circle cx={C - 12} cy={C + 8} r={2.4} fill={c} />
          <Circle cx={C - 4}  cy={C - 2} r={1.8} fill={c} opacity={0.8} />
          <Circle cx={C + 5}  cy={C + 3} r={1.8} fill={c} opacity={0.8} />
          <Path d={star(C + 12, C - 8, 5, 1.8)} fill={c} />
        </G>
      );

    // Explorador Supremo — mapa de constelação completo
    case 'estrela_coroada':
      return (
        <G>
          <Path d={`M ${C - 11} ${C - 7} L ${C - 3} ${C - 10} L ${C + 6} ${C - 4}
                    L ${C + 10} ${C + 6} L ${C} ${C + 10} L ${C - 9} ${C + 4} Z`}
                stroke={c} strokeWidth={1} fill="none" opacity={0.45} />
          <Path d={`M ${C - 3} ${C - 10} L ${C} ${C + 10} M ${C - 9} ${C + 4} L ${C + 6} ${C - 4}`}
                stroke={c} strokeWidth={0.8} opacity={0.35} />
          {[[-11,-7,2.2],[-3,-10,3],[6,-4,2.2],[10,6,2.6],[0,10,3.4],[-9,4,2.2]].map(([x,y,r], i) => (
            <Circle key={i} cx={C + x} cy={C + y} r={r} fill={c} />
          ))}
        </G>
      );

    // Fundador — o primeiro astro, com seu anel planetário
    case 'estrela_anel':
      return (
        <G>
          <Circle cx={C} cy={C} r={7.5} fill={c} />
          <Ellipse cx={C} cy={C} rx={15} ry={4.5} stroke={c} strokeWidth={1.8}
                   fill="none" transform={`rotate(-22 ${C} ${C})`} />
          <Ellipse cx={C} cy={C} rx={15} ry={4.5} stroke={c} strokeWidth={0.8}
                   fill="none" opacity={0.5} transform={`rotate(-22 ${C} ${C})`} />
          {/* Recorte do anel passando por trás do astro */}
          <Path d={`M ${C - 5.5} ${C + 1.6} A 7.5 7.5 0 0 0 ${C + 5.5} ${C - 1.6}`}
                stroke={c} strokeWidth={1.8} fill="none" />
        </G>
      );

    // Pioneiro — semente cósmica irradiando em todas as direções
    case 'estrela_irradiando':
      return (
        <G>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
            <Line key={deg}
              x1={C} y1={C - (i % 2 === 0 ? 8 : 7)}
              x2={C} y2={C - (i % 2 === 0 ? 16 : 12.5)}
              stroke={c} strokeWidth={i % 2 === 0 ? 1.9 : 1.1}
              strokeLinecap="round" opacity={i % 2 === 0 ? 0.95 : 0.55}
              transform={`rotate(${deg} ${C} ${C})`} />
          ))}
          <Circle cx={C} cy={C} r={6} fill={c} />
          <Circle cx={C} cy={C} r={9.5} stroke={c} strokeWidth={0.9} fill="none" opacity={0.4} />
        </G>
      );

    // ══ MÉRITO ══

    // Mestre — três fases de um corpo celeste
    case 'barras_duas':
      return (
        <G>
          <Circle cx={C - 11} cy={C} r={4.6} stroke={c} strokeWidth={1.4} fill="none" />
          <Path d={`M ${C} ${C - 5.4} A 5.4 5.4 0 0 1 ${C} ${C + 5.4} Z`} fill={c} />
          <Circle cx={C} cy={C} r={5.4} stroke={c} strokeWidth={1.4} fill="none" />
          <Circle cx={C + 11} cy={C} r={6.2} fill={c} />
        </G>
      );

    // Devoto — órbita elíptica de longo período, com o perihélio
    case 'barras_tres':
      return (
        <G>
          <Ellipse cx={C - 2} cy={C} rx={16} ry={9} stroke={c} strokeWidth={1.3}
                   fill="none" opacity={0.7} transform={`rotate(-12 ${C} ${C})`} />
          <Circle cx={C - 2} cy={C} r={4.8} fill={c} />
          <Circle cx={C + 13.5} cy={C - 3.2} r={2.8} fill={c} />
          {/* Rastro no ponto mais próximo */}
          <Path d={`M ${C + 10} ${C - 2.4} L ${C + 4} ${C - 0.8}`}
                stroke={c} strokeWidth={1.1} strokeLinecap="round" opacity={0.5} />
        </G>
      );

    // Mestre Supremo — sistema de três anéis concêntricos
    case 'barras_estrela':
      return (
        <G>
          <Circle cx={C} cy={C} r={16} stroke={c} strokeWidth={0.9} fill="none" opacity={0.35} />
          <Circle cx={C} cy={C} r={11} stroke={c} strokeWidth={1.1} fill="none" opacity={0.5} />
          <Circle cx={C} cy={C} r={6}  stroke={c} strokeWidth={1.3} fill="none" opacity={0.7} />
          <Circle cx={C} cy={C} r={3}  fill={c} />
          <Circle cx={C}      cy={C - 16} r={2.2} fill={c} />
          <Circle cx={C + 11} cy={C}      r={2}   fill={c} opacity={0.85} />
          <Circle cx={C - 4.5} cy={C + 4} r={1.8} fill={c} opacity={0.7} />
        </G>
      );

    // Devoto Supremo — coroa de satélites em órbita fechada
    case 'barras_coroa':
      return (
        <G>
          <Circle cx={C} cy={C} r={13} stroke={c} strokeWidth={1.1} fill="none" opacity={0.5} />
          {[0, 60, 120, 180, 240, 300].map((deg, i) => (
            <Circle key={deg}
              cx={C} cy={C - 13} r={i % 2 === 0 ? 2.8 : 1.9}
              fill={c} opacity={i % 2 === 0 ? 1 : 0.6}
              transform={`rotate(${deg} ${C} ${C})`} />
          ))}
          <Circle cx={C} cy={C} r={6.5} fill={c} />
          <Circle cx={C - 2} cy={C - 2} r={1.6} fill="#FFFFFF" opacity={0.35} />
        </G>
      );

    // ══ ESPECIAIS ══

    // Guardião da Sintonia — escudo de campo de força
    case 'escudo_estrela':
      return (
        <G>
          <Path d={`M ${C} ${C - 15} L ${C + 12} ${C - 9} V ${C + 2}
                    C ${C + 12} ${C + 9} ${C + 6} ${C + 13} ${C} ${C + 15}
                    C ${C - 6} ${C + 13} ${C - 12} ${C + 9} ${C - 12} ${C + 2}
                    V ${C - 9} Z`}
                stroke={c} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
          <Path d={`M ${C} ${C - 10.5} L ${C + 8} ${C - 6} V ${C + 1}
                    C ${C + 8} ${C + 6} ${C + 4} ${C + 8.5} ${C} ${C + 10}
                    C ${C - 4} ${C + 8.5} ${C - 8} ${C + 6} ${C - 8} ${C + 1}
                    V ${C - 6} Z`}
                fill={c} opacity={0.18} />
          <Circle cx={C} cy={C - 1} r={3.6} fill={c} />
          <Ellipse cx={C} cy={C - 1} rx={8} ry={3} stroke={c} strokeWidth={1.1}
                   fill="none" opacity={0.7} />
        </G>
      );

    // Apoiador — prisma refratando luz
    case 'cristal':
      return (
        <G>
          <Path d={`M ${C} ${C - 15} L ${C + 10} ${C - 2} L ${C} ${C + 15} L ${C - 10} ${C - 2} Z`}
                stroke={c} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
          <Path d={`M ${C - 10} ${C - 2} H ${C + 10}`} stroke={c} strokeWidth={0.9} opacity={0.55} />
          <Path d={`M ${C} ${C - 15} V ${C + 15}`} stroke={c} strokeWidth={0.7} opacity={0.4} />
          <Path d={`M ${C} ${C - 15} L ${C - 4.5} ${C - 2} L ${C} ${C + 15}`}
                fill={c} opacity={0.22} />
          {/* Feixe saindo da faceta direita */}
          <Line x1={C + 8} y1={C - 4} x2={C + 15} y2={C - 9}
                stroke={c} strokeWidth={1.2} strokeLinecap="round" opacity={0.6} />
        </G>
      );

    // Creator Zero — singularidade, com o disco de acreção
    case 'zero':
      return (
        <G>
          <Ellipse cx={C} cy={C} rx={16} ry={5.5} stroke={c} strokeWidth={1.4}
                   fill="none" opacity={0.75} transform={`rotate(-16 ${C} ${C})`} />
          <Ellipse cx={C} cy={C} rx={12} ry={3.6} stroke={c} strokeWidth={0.9}
                   fill="none" opacity={0.45} transform={`rotate(-16 ${C} ${C})`} />
          {/* O vazio no centro — o zero */}
          <Circle cx={C} cy={C} r={6.4} stroke={c} strokeWidth={2.2} fill="none" />
          <Circle cx={C} cy={C} r={3.4} fill={c} opacity={0.12} />
        </G>
      );

    // ══ ESTÁGIOS DE PRESTÍGIO ══

    // Desperto — a primeira faísca no escuro
    case 'faisca':
      return (
        <G>
          <Circle cx={C} cy={C} r={4} fill={c} />
          {[0, 120, 240].map(deg => (
            <Line key={deg} x1={C} y1={C - 7} x2={C} y2={C - 12}
                  stroke={c} strokeWidth={1.5} strokeLinecap="round" opacity={0.7}
                  transform={`rotate(${deg} ${C} ${C})`} />
          ))}
          <Circle cx={C} cy={C} r={11} stroke={c} strokeWidth={0.7}
                  fill="none" opacity={0.3} strokeDasharray="2 3" />
        </G>
      );

    // Guardião — broto orbital, vida em formação
    case 'broto':
      return (
        <G>
          <Path d={`M ${C} ${C + 13} V ${C - 4}`} stroke={c} strokeWidth={1.8} strokeLinecap="round" />
          <Path d={`M ${C} ${C + 3} C ${C - 9} ${C + 2} ${C - 11} ${C - 5} ${C - 10} ${C - 9}
                    C ${C - 5} ${C - 9} ${C - 1} ${C - 4} ${C} ${C + 1} Z`} fill={c} opacity={0.85} />
          <Path d={`M ${C} ${C - 1} C ${C + 8} ${C - 2} ${C + 10} ${C - 8} ${C + 9} ${C - 12}
                    C ${C + 4} ${C - 12} ${C + 1} ${C - 7} ${C} ${C - 3} Z`} fill={c} />
          <Circle cx={C} cy={C + 13} r={2} fill={c} opacity={0.6} />
        </G>
      );

    // Mentor — flor de seis pétalas, o que já floresceu e ensina
    case 'flor':
      return (
        <G>
          {[0, 60, 120, 180, 240, 300].map(deg => (
            <Ellipse key={deg} cx={C} cy={C - 8} rx={3.6} ry={7}
                     fill={c} opacity={0.75}
                     transform={`rotate(${deg} ${C} ${C})`} />
          ))}
          <Circle cx={C} cy={C} r={4.2} fill={c} />
          <Circle cx={C} cy={C} r={4.2} stroke="#FFFFFF" strokeWidth={0.8}
                  fill="none" opacity={0.3} />
        </G>
      );

    // Constelação — a cruz do sul, estrelas que guiam
    case 'cruzeiro':
      return (
        <G>
          <Path d={`M ${C + 1} ${C - 14} L ${C - 1} ${C + 14} M ${C - 11} ${C - 1} L ${C + 10} ${C + 3}`}
                stroke={c} strokeWidth={0.8} opacity={0.4} />
          <Path d={star(C + 1,  C - 14, 4.6, 1.6)} fill={c} />
          <Path d={star(C - 1,  C + 14, 5.4, 1.9)} fill={c} />
          <Path d={star(C - 11, C - 1,  4,   1.4)} fill={c} />
          <Path d={star(C + 10, C + 3,  4,   1.4)} fill={c} />
          <Circle cx={C + 3} cy={C + 6} r={1.8} fill={c} opacity={0.7} />
        </G>
      );

    // Lenda da Sintonia — supernova, o fim que vira começo
    case 'supernova':
      return (
        <G>
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => (
            <Line key={deg}
              x1={C} y1={C - 6} x2={C} y2={C - (i % 3 === 0 ? 17 : i % 2 === 0 ? 13 : 10)}
              stroke={c}
              strokeWidth={i % 3 === 0 ? 1.8 : 1}
              strokeLinecap="round"
              opacity={i % 3 === 0 ? 0.95 : 0.45}
              transform={`rotate(${deg} ${C} ${C})`} />
          ))}
          <Circle cx={C} cy={C} r={7} fill={c} />
          <Circle cx={C} cy={C} r={4} fill="#FFFFFF" opacity={0.55} />
        </G>
      );

    default:
      return <Circle cx={C} cy={C} r={5} fill={c} />;
  }
}

/** Estrela de quatro pontas com lados côncavos. */
function star(cx: number, cy: number, outer: number, inner: number): string {
  return [
    `M ${cx} ${cy - outer}`,
    `Q ${cx + inner * 0.35} ${cy - inner} ${cx + inner} ${cy - inner * 0.35}`,
    `Q ${cx + outer * 0.35} ${cy} ${cx + inner} ${cy + inner * 0.35}`,
    `Q ${cx + inner * 0.35} ${cy + inner} ${cx} ${cy + outer}`,
    `Q ${cx - inner * 0.35} ${cy + inner} ${cx - inner} ${cy + inner * 0.35}`,
    `Q ${cx - outer * 0.35} ${cy} ${cx - inner} ${cy - inner * 0.35}`,
    `Q ${cx - inner * 0.35} ${cy - inner} ${cx} ${cy - outer}`,
    'Z',
  ].join(' ');
}
const styles = StyleSheet.create({
  wrap: {
    alignItems:     'center',
    justifyContent: 'center',
  },
});
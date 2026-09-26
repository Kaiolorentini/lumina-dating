// ============================================
// LUMINA — ÍCONE DO CRISTAL
// src/components/icons/CrystalIcon.tsx
//
// A aba Cristais usava ✨, o mesmo emoji da aba Sintonias — as
// duas ficavam idênticas no rodapé e a pessoa tocava na
// errada.
//
// Cristal de verdade se lê pelas FACETAS, não pelo contorno:
// um losango liso parece um sinal de trânsito. A face da
// esquerda é escura, a da direita clara, e as duas encontram
// uma aresta central — é o que dá volume com três formas.
//
// Vermelho por escolha de Kaio. O tom quente também separa a
// aba das outras, que são douradas e violeta.
// ============================================

import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Props {
  size?: number;
  /** Cor base. O gradiente deriva dela. */
  color?: string;
}

const RED_LIGHT = '#FF6B6B';
const RED_MID   = '#E23B4E';
const RED_DARK  = '#9B1B33';

export function CrystalIcon({ size = 22, color }: Props) {
  const light = color ?? RED_LIGHT;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id="crystalFaceL" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%"   stopColor={RED_MID} />
          <Stop offset="100%" stopColor={RED_DARK} />
        </LinearGradient>
        <LinearGradient id="crystalFaceR" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%"   stopColor={light} />
          <Stop offset="100%" stopColor={RED_MID} />
        </LinearGradient>
        <LinearGradient id="crystalTop" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%"   stopColor="#FFB3B3" />
          <Stop offset="100%" stopColor={light} />
        </LinearGradient>
      </Defs>

      {/* Face esquerda — a escura */}
      <Path
        d="M 12 1.5 L 3.5 8.6 L 12 22.5 Z"
        fill="url(#crystalFaceL)"
      />

      {/* Face direita — a clara. A aresta central entre as duas
          é o que cria o volume. */}
      <Path
        d="M 12 1.5 L 20.5 8.6 L 12 22.5 Z"
        fill="url(#crystalFaceR)"
      />

      {/* Chanfro do topo: sem ele a ponta fica afiada demais e
          o cristal parece uma seta. */}
      <Path
        d="M 12 1.5 L 3.5 8.6 L 8 7.2 L 12 5.4 L 16 7.2 L 20.5 8.6 Z"
        fill="url(#crystalTop)"
        opacity={0.9}
      />

      {/* Reflexo: uma lasca clara na face direita. É o detalhe
          que faz o olho ler "vidro" em vez de "pedra". */}
      <Path
        d="M 12.9 6.4 L 16.6 9.4 L 13.4 15.5 Z"
        fill="#FFFFFF"
        opacity={0.28}
      />
    </Svg>
  );
}
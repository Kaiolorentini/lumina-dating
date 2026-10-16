// ============================================
// LUMINA — QR CODE
// src/components/QrCode.tsx
//
// Desenha um QR code com o react-native-svg (já usado no app) e a
// biblioteca `qrcode` só para calcular a matriz. Funciona igual no
// app e na web. Escuro sobre branco, com margem de 4 módulos: é o
// que as câmeras de celular leem melhor (QR claro sobre escuro
// falha em muitos leitores).
//
// Nunca coloque segredo no value (token, senha, link de login):
// um QR aparece em fotos e prints da tela.
// ============================================

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { create } from 'qrcode';

/** Margem branca exigida pela norma do QR, em módulos. */
const QUIET_ZONE = 4;

interface Props {
  value: string;
  /** Lado do QR em pixels. */
  size: number;
  /** Texto lido por leitores de tela. */
  accessibilityLabel: string;
}

interface Matrix { size: number; path: string }

function buildMatrix(value: string): Matrix | null {
  if (!value) return null;
  try {
    const { modules } = create(value, { errorCorrectionLevel: 'M' });
    let path = '';
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.get(row, col)) {
          path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
        }
      }
    }
    return { size: modules.size + QUIET_ZONE * 2, path };
  } catch (error) {
    console.warn('[QrCode] Não foi possível gerar o QR code:', error);
    return null;
  }
}

export default function QrCode({ value, size, accessibilityLabel }: Props) {
  const matrix = useMemo(() => buildMatrix(value), [value]);
  if (!matrix) return null;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${matrix.size} ${matrix.size}`}>
        <Rect x={0} y={0} width={matrix.size} height={matrix.size} fill="#FFFFFF" />
        <Path d={matrix.path} fill="#000000" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 8, overflow: 'hidden', backgroundColor: '#FFFFFF' },
});

// ============================================
// LUMINA — MARCA D'ÁGUA MÓVEL
// src/components/media/MovingWatermark.tsx
//
// Identifica o comprador sobre o conteúdo pago: e-mail parcial +
// início do uid, mudando de posição a cada 4 s. Parada num canto,
// um corte simples removia; em movimento, acompanha qualquer
// gravação ou print que escape do bloqueio.
// ============================================

import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, View, DimensionValue } from 'react-native';

interface Position {
  top?: DimensionValue;
  bottom?: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
}

const POSITIONS: Position[] = [
  { top: '8%', left: '6%' },
  { top: '42%', right: '8%' },
  { bottom: '14%', left: '10%' },
  { top: '24%', left: '32%' },
  { bottom: '30%', right: '12%' },
];

const INTERVAL_MS = 4000;

/** kaio.silva@gmail.com → ka•••@gmail.com */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return '';
  return `${local.slice(0, 2)}•••@${domain}`;
}

export default function MovingWatermark({ text }: { text: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex(i => (i + 1) % POSITIONS.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  if (!text) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Text style={[styles.text, POSITIONS[index]]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    position: 'absolute',
    color: '#FFFFFF',
    opacity: 0.35,
    fontSize: 13,
    fontWeight: 'bold',
    transform: [{ rotate: '-12deg' }],
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
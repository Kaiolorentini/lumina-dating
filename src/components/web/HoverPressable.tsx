// ============================================
// LUMINA — BOTÃO/CARTÃO COM EFEITO DE MOUSE
// src/components/web/HoverPressable.tsx
//
// Pressable com um estilo extra enquanto o mouse está em cima
// (computador). No app o onHoverIn nunca dispara: fica um Pressable
// comum. Usado nas telas do computador (Home D3 em diante) para dar
// a resposta visual de "isto é clicável" que o site precisa.
// ============================================

import React, { useState } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

interface Props extends Omit<PressableProps, 'style'> {
  style?:        StyleProp<ViewStyle>;
  /** Aplicado por cima de `style` enquanto o mouse está em cima. */
  hoverStyle?:   StyleProp<ViewStyle>;
  /** Aplicado enquanto pressionado. */
  pressedStyle?: StyleProp<ViewStyle>;
  children?:     React.ReactNode;
}

export default function HoverPressable({
  style, hoverStyle, pressedStyle, children, onHoverIn, onHoverOut, ...rest
}: Props) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      {...rest}
      onHoverIn={event => { setHovered(true); onHoverIn?.(event); }}
      onHoverOut={event => { setHovered(false); onHoverOut?.(event); }}
      style={({ pressed }) => [
        style,
        hovered && !rest.disabled ? hoverStyle : null,
        pressed && !rest.disabled ? pressedStyle : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

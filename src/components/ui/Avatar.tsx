import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { COLORS, FONT_WEIGHT, GLASS } from '../../theme/tokens';
import { ImageWithFallback } from './ImageWithFallback';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';
type AvatarRing = 'none' | 'gold' | 'accent' | 'success';

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: AvatarSize;
  ring?: AvatarRing;
  online?: boolean;
  style?: ImageStyle;
  accessibilityLabel?: string;
}

const SIZE_MAP: Record<AvatarSize, number> = {
  sm: 32,
  md: 48,
  lg: 72,
  xl: 100,
};

const RING_COLORS: Record<AvatarRing, string | undefined> = {
  none: undefined,
  gold: COLORS.gold,
  accent: COLORS.accent,
  success: COLORS.success,
};

const RING_WIDTHS: Record<AvatarSize, number> = {
  sm: 1.5,
  md: 2,
  lg: 2.5,
  xl: 3,
};

export function Avatar({ uri, name, size = 'md', ring = 'none', online, style, accessibilityLabel }: AvatarProps) {
  const dimension = SIZE_MAP[size];
  const radius = dimension / 2;
  const ringColor = RING_COLORS[ring];
  const ringWidth = ring !== 'none' ? RING_WIDTHS[size] : 0;
  const innerDim = ring !== 'none' ? dimension - ringWidth * 2 : dimension;

  const inner = uri ? (
    <ImageWithFallback
      source={{ uri }}
      fallbackIcon="👤"
      style={[
        styles.image,
        { width: innerDim, height: innerDim, borderRadius: innerDim / 2 },
      ]}
    />
  ) : (
    <PlaceholderInner name={name} dimension={innerDim} />
  );

  return (
    <View
      style={[styles.wrapper, { width: dimension, height: dimension }, style as ViewStyle]}
      accessible
      accessibilityLabel={accessibilityLabel || (name ? `Foto de ${name}` : 'Foto de perfil')}
      accessibilityRole="image"
    >
      <View
        style={[
          styles.ring,
          {
            width: dimension,
            height: dimension,
            borderRadius: radius,
            borderColor: ringColor ?? 'transparent',
            borderWidth: ringWidth,
          },
        ]}
      >
        <View
          style={[
            styles.inner,
            { width: innerDim, height: innerDim, borderRadius: innerDim / 2 },
          ]}
        >
          {inner}
        </View>
      </View>
      {online && (
        <View
          style={[styles.onlineDot, { width: dimension * 0.25, height: dimension * 0.25, borderRadius: dimension * 0.125 }]}
          accessibilityElementsHidden
        />
      )}
    </View>
  );
}

function PlaceholderInner({ name, dimension }: { name?: string; dimension: number }) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  const fontSize = dimension * 0.38;

  return (
    <View style={[styles.fallback, { width: dimension, height: dimension, borderRadius: dimension / 2 }]}>
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    overflow: 'hidden',
  },
  image: {
    backgroundColor: COLORS.card,
  },
  fallback: {
    backgroundColor: GLASS.tintHeavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: COLORS.accent,
    fontWeight: FONT_WEIGHT.bold,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
});

// ============================================
// LUMINA — PROFILE FRAME COMPONENT
// src/components/profile/ProfileFrame.tsx
//
// Moldura de perfil baseada no tier do usuário.
// Placeholder visual enquanto assets não chegam.
// Quando assets chegarem: substituir borderStyle
// por Image overlay com frame asset.
// ============================================

import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, TIER_COLORS, TIER_GLOW, SHADOWS } from '../../theme/tokens';
import { getFrameAsset } from '../../assets';

type Tier = 'comum' | 'raro' | 'epico' | 'lendario' | 'galaxia';

interface ProfileFrameProps {
  photoURL:   string;
  tier?:      Tier;
  size?:      number;
  style?:     ViewStyle;
}

export function ProfileFrame({
  photoURL,
  tier  = 'comum',
  size  = 80,
  style,
}: ProfileFrameProps) {
  const frameAsset  = getFrameAsset(tier);
  const borderColor = TIER_COLORS[tier];
  const glowColor   = TIER_GLOW[tier];
  const borderWidth = tier === 'comum' ? 0 : tier === 'galaxia' ? 3 : 2;

  const containerStyle: ViewStyle = {
    width:        size + borderWidth * 2 + 4,
    height:       size + borderWidth * 2 + 4,
    borderRadius: (size + borderWidth * 2 + 4) / 2,
    borderWidth,
    borderColor,
    padding:      2,
    // Glow effect via shadow
    shadowColor:   glowColor,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: tier !== 'comum' ? 1 : 0,
    shadowRadius:  tier === 'galaxia' ? 12 : 6,
    elevation:     tier !== 'comum' ? 8 : 0,
  };

  return (
    <View style={[containerStyle, style]}>
      <Image
        source={{ uri: photoURL }}
        style={{
          width:        size,
          height:       size,
          borderRadius: size / 2,
        }}
        resizeMode="cover"
      />

      {/* Overlay do frame asset — ativo quando asset existir */}
      {frameAsset && (
        <Image
          source={frameAsset as number}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: (size + borderWidth * 2 + 4) / 2 },
          ]}
          resizeMode="cover"
        />
      )}

      {/* Badge de tier Galáxia Plus */}
      {tier === 'galaxia' && (
        <View style={[styles.galaxiaBadge, {
          width:  size * 0.28,
          height: size * 0.28,
          bottom: 0,
          right:  0,
        }]}>
          {/* Substituir por PREMIUM_ASSETS.badgeGalaxiaPlus quando disponível */}
          <View style={styles.galaxiaBadgePlaceholder} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
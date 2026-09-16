// ============================================
// LUMINA — PROFILE CARD v2.0
// src/components/ProfileCard.tsx
//
// FASE 8 — a moldura virou o fundo do card e o badge ganhou
// faixa própria.
//
// v1 tinha a cena num quadrado centralizado, sobrando cinza em
// volta, e o badge como ícone de 26px ao lado do nome — sumia.
// Agora: a cena preenche a área da foto inteira, e o badge tem
// uma faixa com o significado, que é o que ele comunica.
//
// A validade do aluguel é checada no usersService, não aqui: o
// card recebe o id já filtrado ou null.
// ============================================

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../theme';
import { ProfileCardData } from '../shared/types';
import BoostBadge from './BoostBadge';
import { ProfileFrame } from './profile/ProfileFrame';
import { Badge } from './profile/Badge';
import {
  frameAppearanceById, badgeAppearanceById, badgeMeaningById,
  BADGES, RARITY_COLOR, Rarity,
} from '../config/cosmeticsCatalog';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.lg * 2 - spacing.sm) / 2;
const PHOTO_RATIO = 1.15;

interface Props {
  data: ProfileCardData;
  onPress: () => void;
}

export default function ProfileCard({ data, onPress }: Props) {
  const frame = frameAppearanceById(data.equippedFrame);
  const badge = data.equippedBadge
    ? badgeAppearanceById(data.equippedBadge, (data.equippedBadgeRarity as Rarity) ?? 'COMMON')
    : null;
  const meaning = badgeMeaningById(data.equippedBadge);

  // Cor da faixa: raridade do badge da loja, ou a que veio do
  // documento para badges de conquista.
  const badgeRarity = data.equippedBadge
    ? BADGES[data.equippedBadge]?.rarity ?? data.equippedBadgeRarity ?? 'COMMON'
    : 'COMMON';
  const stripColor = RARITY_COLOR[badgeRarity] ?? colors.gold;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* Com moldura, a cena preenche a área inteira e a foto
          flutua no centro. Sem moldura, a foto ocupa tudo como
          antes — nada regride para quem não tem cosmético. */}
      {frame ? (
        <ProfileFrame
          photoURL={data.photoURL}
          size={CARD_WIDTH}
          ratio={PHOTO_RATIO}
          frame={frame}
        />
      ) : (
        <Image source={{ uri: data.photoURL }} style={styles.photo} />
      )}

      {(data.boostType === 'turbo' || data.boostType === 'destaque') && (
        <BoostBadge type={data.boostType} />
      )}

      <View style={styles.sintoniaContainer}>
        <Text style={styles.sintoniaText}>{data.sintonia}%</Text>
        <Text style={styles.sintoniaLabel}>Sintonia</Text>
      </View>

      {/* Faixa do badge: atravessa o card e separa a foto das
          informações. O badge sozinho não comunica "só de
          passagem" — é o texto que carrega o sentido. */}
      {badge && (
        <View style={[styles.badgeStrip, { borderTopColor: stripColor }]}>
          <Badge appearance={badge} size={38} />
          {meaning && (
            <Text style={styles.badgeMeaning} numberOfLines={2}>
              {meaning}
            </Text>
          )}
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {data.name}, {data.age}
        </Text>
        <Text style={styles.location} numberOfLines={1}>
          📍 {data.location}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  photo: {
    width: '100%',
    height: CARD_WIDTH * PHOTO_RATIO,
    backgroundColor: colors.grayDark,
  },
  sintoniaContainer: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.background + 'CC',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  sintoniaText: {
    color: colors.gold,
    fontSize: fonts.sizes.xs,
    fontWeight: 'bold',
  },
  sintoniaLabel: {
    color: colors.gray,
    fontSize: 8,
  },
  badgeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surfaceRaised,
    borderTopWidth: 2,
    minHeight: 52,
  },
  badgeMeaning: {
    flex: 1,
    color: colors.grayLight,
    fontSize: 10,
    fontStyle: 'italic',
    lineHeight: 13,
  },
  info: {
    padding: spacing.sm,
    gap: 2,
  },
  name: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
  },
  location: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
  },
});
// ============================================
// LUMINA — VISITED PROFILE CARD v2.0
// src/components/VisitedProfileCard.tsx
//
// FASE 8 — mesmo tratamento do ProfileCard: a cena da moldura
// preenche a área da foto e o badge ganha faixa própria.
//
// v1 tinha a moldura num box centralizado, sobrando cinza em
// volta, e o badge como ícone de 26px na linha do nome.
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
  visitCount: number;
  rank: number;
  onPress: () => void;
}

export default function VisitedProfileCard({ data, visitCount, rank, onPress }: Props) {
  const frame = frameAppearanceById(data.equippedFrame);
  const badge = data.equippedBadge
    ? badgeAppearanceById(data.equippedBadge, (data.equippedBadgeRarity as Rarity) ?? 'COMMON')
    : null;
  const meaning = badgeMeaningById(data.equippedBadge);

  const badgeRarity = data.equippedBadge
    ? BADGES[data.equippedBadge]?.rarity ?? data.equippedBadgeRarity ?? 'COMMON'
    : 'COMMON';
  const stripColor = RARITY_COLOR[badgeRarity] ?? colors.gold;

  function getRankColor(): string {
    if (rank === 1) return '#FFD700'; // Ouro
    if (rank === 2) return '#C0C0C0'; // Prata
    if (rank === 3) return '#CD7F32'; // Bronze
    return colors.gold;
  }

  function getRankIcon(): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Cena preenchendo a área da foto, como no feed. */}
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

      {/* Badge de ranking */}
      <View style={[styles.rankBadge, { backgroundColor: getRankColor() }]}>
        <Text style={styles.rankText}>{getRankIcon()}</Text>
      </View>

      {/* Badge de visitas */}
      <View style={styles.visitsBadge}>
        <Text style={styles.visitsText}>👁 {visitCount}</Text>
      </View>

      {/* Sintonia — reposicionada: com a faixa do badge, a
          posição antiga caía em cima dela. */}
      <View style={styles.sintoniaBadge}>
        <Text style={styles.sintoniaText}>{data.sintonia}%</Text>
      </View>

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

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {data.name}, {data.age}
        </Text>
        <Text style={styles.location} numberOfLines={1}>
          📍 {data.location}
        </Text>
        <Text style={styles.visitsLabel}>
          🔥 {visitCount} visitas
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
  rankBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    borderRadius: borderRadius.full,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 16,
  },
  visitsBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.background + 'CC',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  visitsText: {
    color: colors.white,
    fontSize: fonts.sizes.xs,
    fontWeight: 'bold',
  },
  sintoniaBadge: {
    position: 'absolute',
    top: CARD_WIDTH * PHOTO_RATIO - 26,
    right: spacing.sm,
    backgroundColor: colors.gold + 'CC',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  sintoniaText: {
    color: colors.background,
    fontSize: fonts.sizes.xs,
    fontWeight: 'bold',
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
  visitsLabel: {
    color: colors.gold,
    fontSize: fonts.sizes.xs,
    fontWeight: 'bold',
    marginTop: 2,
  },
});
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
  frameAppearanceById, badgeAppearanceById, badgeMeaningById, Rarity,
} from '../config/cosmeticsCatalog';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.lg * 2 - spacing.sm) / 2;

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
      {/* Foto. Com moldura vira circular; sem, segue retangular —
          nada regride para quem não tem cosmético. */}
      {frame ? (
        <View style={styles.framedPhotoBox}>
          <ProfileFrame
            photoURL={data.photoURL}
            size={CARD_WIDTH * 0.5}
            frame={frame}
          />
        </View>
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

      {/* Sintonia */}
      <View style={styles.sintoniaBadge}>
        <Text style={styles.sintoniaText}>{data.sintonia}%</Text>
      </View>

      {/* Info. O badge fica aqui e não sobre a foto: o card já tem
          rank, visitas e sintonia lá, e um quarto elemento viraria
          poluição. */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          {badge && <Badge appearance={badge} size={26} />}
          <Text style={styles.name} numberOfLines={1}>
            {data.name}, {data.age}
          </Text>
        </View>
        <Text style={styles.location} numberOfLines={1}>
          📍 {data.location}
        </Text>
        {meaning && (
          <Text style={styles.meaning} numberOfLines={2}>
            {meaning}
          </Text>
        )}
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
    height: CARD_WIDTH * 1.3,
    backgroundColor: colors.grayDark,
  },
  framedPhotoBox: {
    width: '100%',
    height: CARD_WIDTH * 1.3,
    backgroundColor: colors.grayDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  meaning: {
    color: colors.gold,
    fontSize: fonts.sizes.xs,
    fontStyle: 'italic',
    lineHeight: 14,
    opacity: 0.85,
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
    bottom: 52,
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
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
import { ProfileCardData } from './ProfileCard';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.lg * 2 - spacing.sm) / 2;

interface Props {
  data: ProfileCardData;
  visitCount: number;
  rank: number;
  onPress: () => void;
}

export default function VisitedProfileCard({ data, visitCount, rank, onPress }: Props) {
  function getRankColor(): string {
    if (rank === 1) return colors.goldLegacy; // Ouro
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
      {/* Foto */}
      <Image
        source={{ uri: data.photoURL }}
        style={styles.photo}
      />

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
    height: CARD_WIDTH * 1.3,
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
    fontSize: fonts.sizes.lg,
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
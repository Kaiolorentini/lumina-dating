import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, alpha } from '../theme/tokens';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.lg * 2 - SPACING.sm) / 2;

export interface ProfileCardData {
  id: string;
  name: string;
  age: number;
  location: string;
  sintonia: number;
  photoURL: string;
}

interface Props {
  data: ProfileCardData;
  onPress: () => void;
}

export default function ProfileCard({ data, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <Image
        source={{ uri: data.photoURL }}
        style={styles.photo}
        defaultSource={{ uri: 'https://randomuser.me/api/portraits/lego/1.jpg' }}
      />

      <View style={styles.sintoniaContainer}>
        <Text style={styles.sintoniaText}>{data.sintonia}%</Text>
        <Text style={styles.sintoniaLabel}>Sintonia</Text>
      </View>

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
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photo: {
    width: '100%',
    height: CARD_WIDTH * 1.3,
    backgroundColor: COLORS.border,
  },
  sintoniaContainer: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: alpha(COLORS.background, 0.8),
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  sintoniaText: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  sintoniaLabel: {
    color: COLORS.textSecondary,
    fontSize: 8,
  },
  info: {
    padding: SPACING.sm,
  },
  name: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.bold,
  },
  location: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
});
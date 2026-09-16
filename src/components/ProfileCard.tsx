// ============================================
// LUMINA — PROFILE CARD
// src/components/ProfileCard.tsx
//
// FASE 5 Etapa 2: moldura e badge equipados aparecem para
// QUEM VÊ o perfil, não só para o dono. É o que dá sentido à
// compra — ninguém paga por algo que só ele enxerga.
//
// A validade do aluguel é checada aqui: equippedFrameUntil vem
// no documento justamente porque a limpeza automática do
// getFramesStatus só roda quando o próprio dono abre o app.
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
  frameAppearanceById, badgeAppearanceById, badgeMeaningById, Rarity,
} from '../config/cosmeticsCatalog';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.lg * 2 - spacing.sm) / 2;

interface Props {
  data: ProfileCardData;
  onPress: () => void;
}

export default function ProfileCard({ data, onPress }: Props) {
  const frame = frameAppearanceById(data.equippedFrame);
  const badge = data.equippedBadge
    ? badgeAppearanceById(data.equippedBadge, (data.equippedBadgeRarity as Rarity) ?? 'COMMON')
    : null;
  // O significado é o produto: um símbolo sozinho não comunica
  // "só de passagem". Badges de conquista não têm meaning e
  // aparecem só como símbolo.
  const meaning = badgeMeaningById(data.equippedBadge);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* Com moldura, a foto vira circular e ganha a borda. Sem
          moldura, segue retangular como sempre — nada regride
          para quem não tem cosmético. */}
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

      {(data.boostType === 'turbo' || data.boostType === 'destaque') && (
        <BoostBadge type={data.boostType} />
      )}

      <View style={styles.sintoniaContainer}>
        <Text style={styles.sintoniaText}>{data.sintonia}%</Text>
        <Text style={styles.sintoniaLabel}>Sintonia</Text>
      </View>

      <View style={styles.info}>
        {/* Badge saiu de cima da foto para a linha do nome: em
            30px sobre a imagem ele sumia, e o significado não
            tinha onde caber. */}
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
  info: {
    padding: spacing.sm,
    gap: 2,
    // Altura mínima para o card não pular quando um perfil tem
    // significado e o vizinho não tem.
    minHeight: 86,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  meaning: {
    color: colors.gold,
    fontSize: fonts.sizes.xs,
    fontStyle: 'italic',
    lineHeight: 14,
    marginTop: 2,
    opacity: 0.85,
  },
  location: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    marginTop: 2,
  },
});
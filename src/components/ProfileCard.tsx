// ============================================
// LUMINA — PROFILE CARD v3.0
// src/components/ProfileCard.tsx
//
// v3.0 — SINTONIZAR NO CARD.
//
// Curtir exigia abrir o perfil da pessoa. Além do atrito, isso
// disparava um PROFILE_VISIT antes de cada PROFILE_LIKE —
// dois eventos de gamificação onde bastaria um.
//
// O botão ocupa a largura inteira, abaixo do significado do
// badge, e o toque NÃO propaga para o card: sem
// stopPropagation o onPress do TouchableOpacity externo
// dispararia junto e a curtida também navegaria para o perfil.
//
// v2.0 — a moldura virou o fundo do card e o badge ganhou
// faixa própria. A validade do aluguel é checada no
// usersService, não aqui: o card recebe o id já filtrado.
// ============================================

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../theme';
import { ProfileCardData } from '../shared/types';
import BoostBadge from './BoostBadge';
import { ProfileFrame } from './profile/ProfileFrame';
import { Badge } from './profile/Badge';
import { useLike } from '../hooks/useLike';
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
  /** uid de quem está vendo o feed. Sem ele o botão não aparece. */
  viewerUid?: string;
}

export default function ProfileCard({ data, onPress, viewerUid }: Props) {
  const frame = frameAppearanceById(data.equippedFrame);
  const badge = data.equippedBadge
    ? badgeAppearanceById(data.equippedBadge, (data.equippedBadgeRarity as Rarity) ?? 'COMMON')
    : null;
  const meaning = badgeMeaningById(data.equippedBadge);

  // Estado local apenas: consultar no carregamento se cada
  // perfil já foi curtido custaria uma leitura por card — 20
  // por página do feed, milhares por minuto em escala. O guard
  // real está no servidor (onCreateMatch devolve alreadyLiked).
  const [liked, setLiked] = useState(false);
  const { like, liking } = useLike(viewerUid);

  // Cor da faixa: raridade do badge da loja, ou a que veio do
  // documento para badges de conquista.
  const badgeRarity = data.equippedBadge
    ? BADGES[data.equippedBadge]?.rarity ?? data.equippedBadgeRarity ?? 'COMMON'
    : 'COMMON';
  const stripColor = RARITY_COLOR[badgeRarity] ?? colors.gold;

  async function handleLike(event: GestureResponderEvent) {
    // Sem isto o onPress do card dispara junto e curtir navega
    // para o perfil.
    event.stopPropagation();

    if (liked || liking || !viewerUid) return;

    // Otimista: o coração responde na hora, a CF confirma depois.
    setLiked(true);

    const result = await like(data.id);

    if (!result.ok) {
      setLiked(false);
      Alert.alert('Erro', 'Não foi possível registrar a sintonia.');
      return;
    }

    if (result.isMutual) {
      Alert.alert('✦ Sintonia!', 'Vocês se curtiram. Que tal iniciar uma conversa?');
    }
  }

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
          passagem" — é o texto que carrega o sentido, e por
          isso ele aparece INTEIRO, sem numberOfLines. Cards de
          alturas diferentes no grid são o preço disso. */}
      {badge && (
        <View style={[styles.badgeStrip, { borderTopColor: stripColor }]}>
          <Badge appearance={badge} size={38} />
          {meaning && (
            <Text style={styles.badgeMeaning}>{meaning}</Text>
          )}
        </View>
      )}

      {/* Sintonizar — largura inteira, abaixo do significado. */}
      {viewerUid && (
        <TouchableOpacity
          style={[styles.likeBar, liked && styles.likeBarActive]}
          onPress={handleLike}
          disabled={liked || liking}
          activeOpacity={0.8}
        >
          {liking ? (
            <ActivityIndicator color={liked ? colors.white : colors.gold} size="small" />
          ) : (
            <>
              <Text style={styles.likeIcon}>{liked ? '❤️' : '🤍'}</Text>
              <Text style={[styles.likeLabel, liked && styles.likeLabelActive]}>
                {liked ? 'Sintonizando' : 'Sintonizar'}
              </Text>
            </>
          )}
        </TouchableOpacity>
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
  likeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    backgroundColor: colors.gold + '18',
    borderTopWidth: 1,
    borderTopColor: colors.gold + '44',
  },
  likeBarActive: {
    backgroundColor: '#E91E63',
    borderTopColor: '#E91E63',
  },
  likeIcon: {
    fontSize: 16,
  },
  likeLabel: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  likeLabelActive: {
    color: colors.white,
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
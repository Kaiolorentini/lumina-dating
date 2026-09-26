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
import { TitleSeal } from './profile/TitleSeal';
import { titleById } from '../config/titlesCatalog';
import { auraByStage } from '../config/prestigeAura';
import { PrestigeAura } from './profile/PrestigeAura';
import {
  frameAppearanceById, badgeAppearanceById, badgeMeaningById,
  BADGES, RARITY_COLOR, Rarity,
} from '../config/cosmeticsCatalog';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.lg * 2 - spacing.sm) / 2;
const PHOTO_RATIO = 1.15;

/**
 * Altura aproximada do card, para o SVG da aura preencher tudo.
 *
 * É estimativa e não medida real: usar onLayout daria o valor
 * exato, mas custaria um render a mais por card e o SVG é
 * recortado pelo `overflow: hidden` de qualquer forma — sobrar
 * altura é inofensivo, faltar deixaria a base sem aura.
 *
 * foto (CARD_WIDTH * 1.15) + faixa do badge (~52) + botão
 * (~40) + nome e local (~52).
 */
const CARD_HEIGHT_ESTIMATE = CARD_WIDTH * PHOTO_RATIO + 150;

interface Props {
  data: ProfileCardData;
  onPress: () => void;
  /** uid de quem está vendo o feed. Sem ele o botão não aparece. */
  viewerUid?: string;
  /**
   * Liga a animação da AURA. Padrão false.
   *
   * Na grade da Home vários cards ficam visíveis ao mesmo
   * tempo, e a aura é o elemento mais pesado — três SVGs com
   * chamas por card. A moldura e o badge continuam animando
   * nas duas telas: eles são leves e é o que a pessoa comprou.
   *
   * A aba Sintonize mostra um card por vez e passa true.
   */
  animatedAura?: boolean;
  /** Chamado depois que a curtida foi registrada. O Sintonize
   *  usa para comemorar e avançar. */
  onLiked?: () => void;
}

export default function ProfileCard({
  data, onPress, viewerUid, animatedAura = false, onLiked,
}: Props) {
  const frame = frameAppearanceById(data.equippedFrame);
  const badge = data.equippedBadge
    ? badgeAppearanceById(data.equippedBadge, (data.equippedBadgeRarity as Rarity) ?? 'COMMON')
    : null;
  const meaning = badgeMeaningById(data.equippedBadge);
  const title   = titleById(data.equippedTitle);

  // A aura estiliza o CARD — borda e brilho —, em vez de
  // disputar espaço com a moldura. O que a pessoa comprou e o
  // que conquistou se somam.
  //
  // Estágio 0 devolve null de propósito: "Desperto" é o padrão
  // de todo mundo, e se todo card tem aura, nenhum tem.
  const aura = auraByStage(data.prestigeStage);

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

    // Avisa a tela. No Sintonize isso dispara os corações e o
    // avanço para o próximo perfil; na grade ninguém escuta.
    onLiked?.();
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        aura && {
          borderColor: aura.color,
          // shadowOpacity cresce com o estágio: o Guardião é
          // quase imperceptível, a Lenda se destaca no feed.
          shadowColor:   aura.color,
          shadowOpacity: aura.glow,
          shadowRadius:  aura.glow * 14,
          shadowOffset:  { width: 0, height: 0 },
          elevation:     aura.glow > 0.5 ? 8 : 4,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Com moldura, a cena preenche a área inteira e a foto
          flutua no centro. Sem moldura, a foto ocupa tudo como
          antes — nada regride para quem não tem cosmético. */}
      {/* Aura ATRÁS de tudo — é a atmosfera do card, não um
          enfeite sobre a foto. A primeira versão usava
          partículas em órbita e elas apareciam por cima da
          moldura.
          Animação só nos estágios 3 e 4: o feed mostra vários
          cards ao mesmo tempo. */}
      {aura && (
        <PrestigeAura
          color={aura.color}
          intensity={aura.glow}
          // Dois requisitos: a tela precisa permitir E o estágio
          // precisa ser alto. Na grade nunca anima; no Sintonize,
          // só Constelação e Lenda.
          animated={animatedAura && aura.stage >= 3}
          width={CARD_WIDTH}
          height={CARD_HEIGHT_ESTIMATE}
        />
      )}

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

      {/* Símbolo do título — canto ESQUERDO, espelhando o selo
          de sintonia à direita. Só o símbolo: o nome completo
          aparece no perfil aberto, onde há espaço. A patente se
          lê de relance, sem precisar de legenda. */}
      {title && (
        <View style={styles.titleContainer}>
          <TitleSeal title={title} size={26} />
        </View>
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
  titleContainer: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    // Preenchimento menor que o do símbolo antigo: o selo já
    // tem o próprio anel, e o fundo circular por baixo só
    // precisa garantir contraste contra fotos claras.
    backgroundColor: colors.background + 'CC',
    borderRadius: borderRadius.full,
    padding: 3,
    zIndex: 2,
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
  // Contorno escuro em vez de fundo sólido: um fundo taparia a
  // aura justamente na base, que é de onde as chamas sobem. A
  // sombra de texto funciona contra QUALQUER cor de aura,
  // inclusive as que ainda não existem.
  name: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  location: {
    // Era colors.gray, que sumia sobre a aura dourada e a
    // vermelha.
    color: colors.grayLight,
    fontSize: fonts.sizes.xs,
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
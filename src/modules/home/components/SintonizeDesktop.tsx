// ============================================
// LUMINA — SINTONIZE NO COMPUTADOR
// src/modules/home/components/SintonizeDesktop.tsx
//
// Só no computador (SintonizeScreen escolhe pela useBreakpoint; no
// app nunca aparece). Três colunas:
//   • esquerda: os próximos perfis DESFOCADOS (curiosidade) e a
//     Segunda Chance;
//   • centro: o card inteiro, sem a escala de 1.45 que o cortava,
//     e os botões grandes Passar / Sintonizar / Ver perfil, com os
//     atalhos de teclado;
//   • direita: "Por que vocês combinam" (a mesma SintoniaBar do
//     perfil), interesses em comum em dourado, bio e galeria.
//
// Não lê nada: tudo vem da fila que a tela já carregou.
// ============================================

import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { ProfileCardData, UserProfile } from '../../../shared/types';
import { RealProfile } from '../../../services/usersService';
import ProfileCard from '../../../components/ProfileCard';
import SintoniaBar from '../../../components/SintoniaBar';
import { HeartBurst } from '../../../components/profile/HeartBurst';
import { calcularSintonia } from '../../ai/services/sintoniaCalculator';
import { interestLabel } from '../../../config/sintonia/interestsCatalog';
import { galleryPhotos } from '../../profile/services/photoService';

/** Largura do card no centro. */
const CARD_WIDTH = 380;

interface Props {
  current:        ProfileCardData | null;
  detail:         RealProfile | null;
  viewer:         UserProfile | null;
  upcoming:       ProfileCardData[];
  /** Buscando mais perfis depois do último. */
  refilling:      boolean;
  /** Acabaram os perfis de hoje. */
  finished:       boolean;
  liking:         boolean;
  celebrating:    boolean;
  dismissedCount: number;
  secondChanceCost: number;
  onPass:          () => void;
  onLike:          () => void;
  onOpenProfile:   () => void;
  onOpenDismissed: () => void;
}

export default function SintonizeDesktop({
  current, detail, viewer, upcoming, refilling, finished, liking, celebrating,
  dismissedCount, secondChanceCost, onPass, onLike, onOpenProfile, onOpenDismissed,
}: Props) {
  const breakdown = useMemo(
    () => (viewer && detail ? calcularSintonia(viewer, detail).breakdown : null),
    [viewer, detail],
  );
  const common = useMemo(() => new Set(breakdown?.commonInterests ?? []), [breakdown]);
  const interests = detail?.interests ?? [];
  const photos = detail ? galleryPhotos(detail) : [];
  const busy = liking || celebrating;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.row}>

        {/* ── Esquerda: próximos e Segunda Chance ── */}
        <View style={styles.left} accessibilityLabel="Próximos perfis">
          <Text style={styles.kicker}>Próximos</Text>
          {upcoming.length === 0 ? (
            <Text style={styles.leftHint}>Novos perfis aparecem aqui.</Text>
          ) : (
            upcoming.map(p => (
              <View key={p.id} style={styles.thumb}>
                {p.photoURL ? (
                  <Image source={{ uri: p.photoURL }} style={styles.thumbImg} blurRadius={14} />
                ) : (
                  <View style={[styles.thumbImg, styles.thumbEmpty]} />
                )}
              </View>
            ))
          )}
          {dismissedCount > 0 ? (
            <TouchableOpacity
              style={styles.secondChance}
              onPress={onOpenDismissed}
              accessibilityRole="button"
              accessibilityLabel={`Ver ${dismissedCount} perfis passados hoje`}
            >
              <Text style={styles.secondTitle}>↺ Passados hoje · {dismissedCount}</Text>
              <Text style={styles.secondText}>Segunda Chance por {secondChanceCost} cristais</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.leftHint}>Quem você passar fica guardado aqui por 24 horas.</Text>
          )}
        </View>

        {/* ── Centro: card e ações ── */}
        <View style={styles.center}>
          {current ? (
            <>
              <View style={styles.cardWrap}>
                <ProfileCard
                  data={current}
                  onPress={onOpenProfile}
                  animatedAura
                  width={CARD_WIDTH}
                />
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <HeartBurst active={celebrating} width={CARD_WIDTH} height={560} />
                </View>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.round, busy && styles.disabled]}
                  onPress={onPass}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Passar ${current.name}`}
                >
                  <Text style={styles.roundIcon}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.likeBtn, busy && styles.likeBtnBusy]}
                  onPress={onLike}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Sintonizar com ${current.name}`}
                  accessibilityState={{ busy: liking, disabled: busy }}
                >
                  {liking ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <Text style={styles.likeText}>{celebrating ? '❤️ Sintonizando' : '♥ Sintonizar'}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.round}
                  onPress={onOpenProfile}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver o perfil completo de ${current.name}`}
                >
                  <Text style={styles.roundIcon}>👁</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.shortcuts}>
                Atalhos: ← passa · → sintoniza · espaço abre o perfil
              </Text>
            </>
          ) : refilling && !finished ? (
            <View style={styles.state}>
              <ActivityIndicator color={colors.gold} size="large" />
              <Text style={styles.stateText}>Buscando mais perfis…</Text>
            </View>
          ) : (
            <View style={styles.state}>
              <Text style={styles.stateIcon}>✦</Text>
              <Text style={styles.stateTitle}>Por hoje é isso</Text>
              <Text style={styles.stateText}>
                Você viu todos por aqui. Volte amanhã — quem você passou reaparece em 24 horas.
              </Text>
            </View>
          )}
        </View>

        {/* ── Direita: por que vocês combinam ── */}
        {current && detail && (
          <View style={styles.right}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Por que vocês combinam</Text>
              <SintoniaBar
                score={detail.sintonia}
                showLabel
                showBreakdown={!!breakdown}
                breakdown={breakdown ?? undefined}
              />
            </View>

            {interests.length > 0 && (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Interesses</Text>
                <View style={styles.chips}>
                  {interests.map(id => (
                    <View key={id} style={[styles.chip, common.has(id) && styles.chipCommon]}>
                      <Text style={[styles.chipText, common.has(id) && styles.chipTextCommon]}>
                        {common.has(id) ? '✦ ' : ''}{interestLabel(id)}
                      </Text>
                    </View>
                  ))}
                </View>
                {common.size > 0 && (
                  <Text style={styles.panelHint}>Em dourado: o que vocês dois marcaram</Text>
                )}
              </View>
            )}

            {(detail.bio || photos.length > 0) && (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Sobre</Text>
                {detail.bio ? <Text style={styles.bio}>{detail.bio}</Text> : null}
                {photos.length > 0 && (
                  <View style={styles.gallery}>
                    {photos.map((p, i) => (
                      <TouchableOpacity
                        key={p.slot}
                        style={styles.galleryItem}
                        onPress={onOpenProfile}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={`Foto ${i + 1} de ${current.name}`}
                      >
                        <Image source={{ uri: p.uri }} style={styles.galleryImg} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingVertical: spacing.xl, paddingHorizontal: spacing.xl },
  row: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    alignItems: 'flex-start', gap: spacing.xl,
  },

  left: { width: 200, gap: spacing.sm },
  kicker: { color: colors.gray, fontSize: fonts.sizes.sm, letterSpacing: 1, textTransform: 'uppercase' },
  leftHint: { color: colors.gray, fontSize: fonts.sizes.sm, lineHeight: 18 },
  thumb: { height: 120, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface },
  thumbImg: { width: '100%', height: '100%' },
  thumbEmpty: { backgroundColor: colors.surfaceOverlay },
  secondChance: {
    marginTop: spacing.sm, padding: spacing.md, borderRadius: 12, gap: 4,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldBorder,
  },
  secondTitle: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  secondText:  { color: colors.textSecondary, fontSize: fonts.sizes.sm },

  center: { width: CARD_WIDTH, alignItems: 'center', gap: spacing.lg },
  cardWrap: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6, shadowRadius: 28, elevation: 14,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  round: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.grayDark,
  },
  roundIcon: { color: colors.grayLight, fontSize: 24, fontWeight: 'bold' },
  likeBtn: {
    height: 64, minWidth: 200, paddingHorizontal: spacing.xl, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold,
  },
  likeBtnBusy: { opacity: 0.8 },
  likeText: { color: colors.background, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  disabled: { opacity: 0.5 },
  shortcuts: { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center' },
  state: { minHeight: 420, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  stateIcon: { color: colors.gold, fontSize: 48 },
  stateTitle: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  stateText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center', lineHeight: 22 },

  right: { flexGrow: 1, flexBasis: 320, maxWidth: 380, gap: spacing.md },
  panel: {
    padding: spacing.lg, borderRadius: 18, gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: '#2E2E2E',
  },
  panelTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  panelHint: { color: colors.gray, fontSize: fonts.sizes.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: '#262626' },
  chipCommon: { backgroundColor: colors.goldGlow, borderWidth: 1, borderColor: colors.gold },
  chipText: { color: colors.grayLight, fontSize: fonts.sizes.sm },
  chipTextCommon: { color: colors.gold, fontWeight: 'bold' },
  bio: { color: colors.grayLight, fontSize: fonts.sizes.md, lineHeight: 21 },
  gallery: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  galleryItem: { flex: 1, aspectRatio: 4 / 5, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surfaceOverlay },
  galleryImg: { width: '100%', height: '100%' },
});

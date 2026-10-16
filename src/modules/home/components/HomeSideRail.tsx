// ============================================
// LUMINA — COLUNA "SEU DIA" (HOME DO COMPUTADOR)
// src/modules/home/components/HomeSideRail.tsx
//
// Só no computador. Três cartões que puxam a pessoa de volta:
//   • Quem viu você — contagem real (useVisits, já carregado pela
//     Home) e rostos DESFOCADOS genéricos: nenhuma foto de visitante
//     é baixada aqui; revelar continua sendo a tela Visitantes (paga).
//   • Em alta agora — top 5 do ranking que a aba Em Alta já busca.
//   • Árvore da Sintonia — estágio e quanto falta (getXPStatus).
//
// `layout="row"`: em telas de computador mais estreitas os cartões
// ficam lado a lado acima da grade em vez de numa coluna à direita.
// ============================================

import React from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { colors, fonts, spacing } from '../../../theme';
import { ProfileCardData } from '../../../shared/types';
import HoverPressable from '../../../components/web/HoverPressable';
import { useXP } from '../../engagement/hooks/useXP';
import { treeStageProgress } from '../../engagement/utils/treeProgress';

interface Props {
  uid:            string | undefined;
  layout:         'column' | 'row';
  visitasHoje:    number;
  totalVisitas:   number;
  trending:       ProfileCardData[];
  visitCounts:    Record<string, number>;
  loadingTrending: boolean;
  onRevealVisitors: () => void;
  onOpenProfile:    (uid: string) => void;
  onSeeTrending:    () => void;
  onOpenTree:       () => void;
}

/** Cores dos rostos desfocados — nenhuma foto real é usada. */
const BLUR_TINTS = ['#3A2E4A', '#2E3A45', '#45362A', '#2E4536'];
const MEDALS = ['🥇', '🥈', '🥉'];

function visitsTitle(today: number, total: number): string {
  if (today === 1) return '1 pessoa passou pelo seu perfil hoje.';
  if (today > 1)   return `${today} pessoas passaram pelo seu perfil hoje.`;
  if (total === 1) return '1 pessoa já passou pelo seu perfil.';
  return `${total} pessoas já passaram pelo seu perfil.`;
}

export default function HomeSideRail({
  uid, layout, visitasHoje, totalVisitas, trending, visitCounts, loadingTrending,
  onRevealVisitors, onOpenProfile, onSeeTrending, onOpenTree,
}: Props) {
  const { status: xp, loading: xpLoading, error: xpError } = useXP(uid);
  const isRow = layout === 'row';
  const hasVisits = visitasHoje > 0 || totalVisitas > 0;
  const blurCount = Math.min(4, Math.max(visitasHoje, hasVisits ? 1 : 0));

  // Progresso dentro do estágio atual da Árvore.
  const tree = xp ? treeStageProgress(xp) : { fraction: 0, missing: null };
  const treeFraction = tree.fraction;
  const missing = tree.missing;

  return (
    <View style={[styles.rail, isRow && styles.railRow]} accessibilityLabel="Seu dia no Lumina">

      {/* ── Quem viu você ── */}
      <View style={[styles.card, isRow && styles.cardRow]}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Quem viu você</Text>
          {visitasHoje > 0 && <Text style={styles.cardMeta}>{visitasHoje} hoje</Text>}
        </View>
        {hasVisits ? (
          <>
            <View style={styles.faces} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {Array.from({ length: blurCount }).map((_, i) => (
                <View key={i} style={[styles.face, { backgroundColor: BLUR_TINTS[i % BLUR_TINTS.length] }]}>
                  <Text style={styles.faceMark}>?</Text>
                </View>
              ))}
              {visitasHoje > 4 && <Text style={styles.facesMore}>+{visitasHoje - 4}</Text>}
            </View>
            <Text style={styles.cardText}>{visitsTitle(visitasHoje, totalVisitas)}</Text>
            <HoverPressable
              onPress={onRevealVisitors}
              accessibilityRole="button"
              accessibilityLabel="Revelar quem visitou seu perfil"
              style={styles.goldBtn}
              hoverStyle={styles.goldBtnHover}
            >
              <Text style={styles.goldBtnText}>Revelar quem foi</Text>
            </HoverPressable>
          </>
        ) : (
          <Text style={styles.cardText}>
            Ninguém passou por aqui ainda. Fotos na galeria e interesses preenchidos atraem mais visitas.
          </Text>
        )}
      </View>

      {/* ── Em alta agora ── */}
      <View style={[styles.card, isRow && styles.cardRow]}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Em alta agora</Text>
          <HoverPressable onPress={onSeeTrending} accessibilityRole="button" accessibilityLabel="Ver todos em alta" hoverStyle={styles.linkHover}>
            <Text style={styles.link}>Ver todos</Text>
          </HoverPressable>
        </View>
        {loadingTrending && trending.length === 0 ? (
          <ActivityIndicator color={colors.gold} style={styles.spinner} />
        ) : trending.length === 0 ? (
          <Text style={styles.cardText}>O ranking de hoje ainda está se formando.</Text>
        ) : (
          trending.map((p, i) => (
            <HoverPressable
              key={p.id}
              onPress={() => onOpenProfile(p.id)}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1}º em alta: ${p.name}, ${visitCounts[p.id] ?? 0} visitas`}
              style={styles.trendRow}
              hoverStyle={styles.trendRowHover}
            >
              <Text style={styles.trendRank}>{MEDALS[i] ?? `${i + 1}`}</Text>
              {p.photoURL ? (
                <Image source={{ uri: p.photoURL }} style={styles.trendAvatar} />
              ) : (
                <View style={[styles.trendAvatar, styles.trendAvatarEmpty]} />
              )}
              <Text style={styles.trendName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.trendVisits}>👁 {visitCounts[p.id] ?? 0}</Text>
            </HoverPressable>
          ))
        )}
      </View>

      {/* ── Árvore da Sintonia ── */}
      <HoverPressable
        onPress={onOpenTree}
        accessibilityRole="button"
        accessibilityLabel={xp ? `Árvore da Sintonia: ${xp.treeName}` : 'Árvore da Sintonia'}
        style={[styles.card, isRow && styles.cardRow]}
        hoverStyle={styles.cardHover}
      >
        <Text style={styles.cardTitle}>Árvore da Sintonia</Text>
        {xpLoading && !xp ? (
          <ActivityIndicator color={colors.gold} style={styles.spinner} />
        ) : xp ? (
          <>
            <View style={styles.treeHead}>
              <Text style={styles.treeIcon}>{xp.treeIcon}</Text>
              <View style={styles.treeInfo}>
                <Text style={styles.treeName}>{xp.treeName}</Text>
                <Text style={styles.treeLevel}>Nível {xp.level}</Text>
              </View>
            </View>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${Math.round(treeFraction * 100)}%` }]} />
            </View>
            <Text style={styles.cardText}>
              {xp.nextTreeStage && missing !== null
                ? `Faltam ${missing} XP para ${xp.nextTreeStage.name}. Conversar e sintonizar fazem a árvore crescer.`
                : 'Sua árvore está no estágio máximo. ✦'}
            </Text>
          </>
        ) : (
          <Text style={styles.cardText}>
            {xpError ? 'Não foi possível carregar agora. Toque para abrir.' : 'Toque para ver sua árvore.'}
          </Text>
        )}
      </HoverPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail:    { width: 320, gap: spacing.md },
  railRow: { width: '100%', flexDirection: 'row', alignItems: 'stretch' },
  card: {
    padding: 18, borderRadius: 18, gap: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: '#2E2E2E',
  },
  cardRow:   { flex: 1, minWidth: 0 },
  cardHover: { borderColor: colors.goldBorder },
  cardHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: colors.white, fontSize: 15, fontWeight: 'bold' },
  cardMeta:  { color: colors.gold, fontSize: 13, fontWeight: 'bold' },
  cardText:  { color: colors.textSecondary, fontSize: fonts.sizes.sm, lineHeight: 18 },
  spinner:   { paddingVertical: spacing.md },
  link:      { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  linkHover: { opacity: 0.75 },

  faces:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  face:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3A3A3A' },
  faceMark: { color: 'rgba(255,255,255,0.35)', fontSize: 18, fontWeight: 'bold' },
  facesMore: { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.md },

  goldBtn:      { paddingVertical: 11, borderRadius: 12, alignItems: 'center', backgroundColor: colors.gold },
  goldBtnHover: { backgroundColor: colors.goldLight },
  goldBtnText:  { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },

  trendRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 10 },
  trendRowHover: { backgroundColor: colors.surfaceRaised },
  trendRank:     { width: 24, textAlign: 'center', color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.md },
  trendAvatar:   { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.goldBorder },
  trendAvatarEmpty: { backgroundColor: colors.surfaceOverlay },
  trendName:     { flex: 1, color: colors.white, fontSize: fonts.sizes.md, fontWeight: '600' },
  trendVisits:   { color: colors.gray, fontSize: fonts.sizes.sm },

  treeHead:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  treeIcon:  { fontSize: 34 },
  treeInfo:  { gap: 2 },
  treeName:  { color: colors.goldLight, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  treeLevel: { color: colors.gray, fontSize: fonts.sizes.sm },
  track:     { height: 8, borderRadius: 4, backgroundColor: colors.surfaceOverlay, overflow: 'hidden' },
  bar:       { height: 8, borderRadius: 4, backgroundColor: colors.gold },
});

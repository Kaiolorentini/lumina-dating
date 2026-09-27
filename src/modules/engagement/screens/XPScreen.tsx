// ============================================
// LUMINA — XP SCREEN v5.2
// src/modules/engagement/screens/XPScreen.tsx
//
// Perfil de progressão: XP, Nível, Árvore da Sintonia
//
// v5.2 — as tabelas vêm da getXPStatus. As cópias que viviam
// aqui estavam várias versões atrás do servidor: a Árvore
// mostrava 100/300/700/1500 e a lista de ações prometia XP de
// "Receber curtida", que nada credita. Mudou no servidor, a tela
// acompanha — sem eas update.
//
// Estado de erro próprio: antes, uma falha mostrava valores
// padrão como se fossem reais.
// ============================================

import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { useAuth }         from '../../../context/AuthContext';
import { useXP }           from '../hooks/useXP';
import XPBar               from '../../../components/XPBar';
import Header from '../../../components/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

const SCREEN_TITLE = 'Progressão & Árvore';

const TREE_GRADIENTS: Record<number, [string, string]> = {
  0: ['#0A1A0A', '#1B2E1B'],
  1: ['#0A1A0A', '#1B3B1B'],
  2: ['#1A0A2E', '#2D1B4E'],
  3: ['#1A1A0A', '#2E2D1B'],
  4: ['#1A0A2E', '#4E1B7E'],
};

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

export default function XPScreen() {
  const { user } = useAuth();
  const { status, loading, error, refresh } = useXP(user?.uid);

  const treeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(treeAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(treeAnim, { toValue: 1,    duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [treeAnim]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title={SCREEN_TITLE} showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  if (!status) {
    return (
      <View style={styles.container}>
        <Header title={SCREEN_TITLE} showBack={true} showHome={true} />
        <View style={styles.center}>
          <Text style={styles.errorIcon}>🌱</Text>
          <Text style={styles.errorTitle}>
            {error ? 'Não foi possível carregar' : 'Entre na sua conta'}
          </Text>
          <Text style={styles.errorText}>
            {error
              ? 'Verifique sua conexão e tente de novo.'
              : 'É preciso estar logado para ver sua progressão.'}
          </Text>
          {error && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={refresh}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar de novo"
            >
              <Text style={styles.retryText}>Tentar de novo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const treeStage    = status.treeStage ?? 0;
  const gradient     = TREE_GRADIENTS[treeStage] ?? TREE_GRADIENTS[0];
  const treeProgress = status.treeProgress ?? 0;
  const nextStage    = status.nextTreeStage;
  const treeStages   = status.treeStages ?? [];
  const xpActions    = status.xpActions  ?? [];
  const levelRewards = status.levelRewards ?? [];
  const nextReward   = levelRewards.find(r => !r.received) ?? null;

  return (
    <View style={styles.container}>
      <Header title={SCREEN_TITLE} showBack={true} showHome={true} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Árvore da Sintonia */}
        <LinearGradient colors={gradient} style={styles.treeCard}>
          <Text style={styles.treeCardLabel}>Árvore da Sintonia</Text>

          <Animated.Text style={[styles.treeIcon, { transform: [{ scale: treeAnim }] }]}>
            {status.treeIcon ?? '🌱'}
          </Animated.Text>

          <Text style={styles.treeName}>{status.treeName ?? 'Broto'}</Text>
          <Text style={styles.treeXP}>
            {formatNumber(status.treeXP ?? 0)} XP da Árvore
          </Text>

          {nextStage && (
            <View style={styles.treeProgressSection}>
              <View style={styles.treeProgressHeader}>
                <Text style={styles.treeProgressLabel}>Próximo: {nextStage.icon} {nextStage.name}</Text>
                <Text style={styles.treeProgressValue}>
                  {formatNumber(status.treeXP ?? 0)}/{formatNumber(nextStage.treeXPMin)}
                </Text>
              </View>
              <View style={styles.treeProgressBar}>
                <View style={[styles.treeProgressFill, { width: `${treeProgress * 100}%` as any }]} />
              </View>
            </View>
          )}

          {status.fertilizanteAtivo && (
            <View style={styles.fertBadge}>
              <Text style={styles.fertText}>🌱 Fertilizante ativo — +50% XP</Text>
            </View>
          )}
        </LinearGradient>

        {/* Nível e XP global */}
        <View style={styles.levelCard}>
          <Text style={styles.sectionTitle}>Seu Nível</Text>
          <XPBar
            level={status.level ?? 1}
            tier={status.tier ?? '🌱 Comum'}
            totalXP={status.totalXP ?? 0}
            nextLevelXP={status.nextLevelXP ?? 100}
            progress={status.levelProgress ?? 0}
          />
          <View style={styles.xpTodayRow}>
            <Text style={styles.xpTodayText}>
              XP hoje: {formatNumber(status.xpToday ?? 0)}
              {status.dailyMax ? `/${formatNumber(status.dailyMax)}` : ''}
            </Text>
          </View>
        </View>

        {/* Recompensas de nível — o que cada marco entrega e o
            que já foi recebido. Vem do servidor. */}
        {levelRewards.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recompensas de nível</Text>
            <View style={styles.rewardsContainer}>
              {levelRewards.map(r => {
                const isNext  = nextReward?.level === r.level;
                const missing = Math.max(0, r.xpRequired - (status.totalXP ?? 0));
                return (
                  <View
                    key={r.level}
                    style={[
                      styles.rewardRow,
                      r.received && styles.rewardRowReceived,
                      isNext     && styles.rewardRowNext,
                    ]}
                  >
                    <Text style={styles.rewardStatus}>
                      {r.received ? '✅' : isNext ? '🎁' : '🔒'}
                    </Text>
                    <View style={styles.rewardInfo}>
                      <Text style={[styles.rewardLevel, r.received && styles.rewardLevelReceived]}>
                        Nível {r.level}
                      </Text>
                      <Text style={styles.rewardDetail}>
                        {r.received
                          ? 'Recebido'
                          : isNext
                            ? `Faltam ${formatNumber(missing)} XP`
                            : `${formatNumber(r.xpRequired)} XP`}
                      </Text>
                    </View>
                    <View style={styles.rewardValues}>
                      {r.fragments > 0 && (
                        <Text style={styles.rewardFragments}>🔮 {formatNumber(r.fragments)}</Text>
                      )}
                      {r.crystalsPremium > 0 && (
                        <Text style={styles.rewardPremium}>💎 {formatNumber(r.crystalsPremium)}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
            <Text style={styles.rewardsNote}>
              Fragmentos vão para o seu Cofre. Cristais premium caem direto na carteira.
            </Text>
          </>
        )}

        {/* Estágios da Árvore */}
        {treeStages.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Estágios da Árvore</Text>
            <View style={styles.stagesContainer}>
              {treeStages.map(stage => {
                const isCompleted = treeStage >= stage.stage;
                const isCurrent   = treeStage === stage.stage;
                return (
                  <View key={stage.stage} style={[
                    styles.stageRow,
                    isCompleted && styles.stageRowCompleted,
                    isCurrent   && styles.stageRowCurrent,
                  ]}>
                    <Text style={styles.stageIcon}>{stage.icon}</Text>
                    <View style={styles.stageInfo}>
                      <Text style={[styles.stageName, isCompleted && styles.stageNameCompleted]}>
                        {stage.name}
                      </Text>
                      <Text style={styles.stageReward}>🎁 {stage.rewardLabel}</Text>
                    </View>
                    <View style={styles.stageXP}>
                      <Text style={styles.stageXPText}>{formatNumber(stage.treeXPMin)} XP</Text>
                      {isCompleted && <Text style={styles.stageDone}>✅</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Como ganhar XP */}
        {xpActions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Como ganhar XP</Text>
            <View style={styles.actionsContainer}>
              {xpActions.map(item => (
                <View key={item.action} style={styles.actionRow}>
                  <Text style={styles.actionIcon}>{item.icon}</Text>
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionLabel}>{item.label}</Text>
                    {item.note ? <Text style={styles.actionNote}>{item.note}</Text> : null}
                  </View>
                  <View style={styles.actionRewards}>
                    <Text style={styles.actionXP}>+{item.xp} XP</Text>
                    {item.treeXP > 0 && (
                      <Text style={styles.actionTreeXP}>+{item.treeXP} 🌳</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Info Fertilizante */}
        <View style={styles.fertCard}>
          <Text style={styles.fertTitle}>🌱 Fertilizante da Sintonia</Text>
          <Text style={styles.fertDesc}>
            Disponível com Cristais Premium. Ativa +50% de XP (global e da árvore) por 24h.
            Não afeta Fragmentos, Cristais ou Cofre.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl, gap: S.sm },

  // Erro
  errorIcon:   { fontSize: 44, opacity: 0.8 },
  errorTitle:  { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  errorText:   { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  retryButton: { marginTop: S.md, borderWidth: 1, borderColor: COLORS.secondary, borderRadius: R.full, paddingHorizontal: S.xl, paddingVertical: S.sm },
  retryText:   { color: COLORS.secondary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },

  // Árvore
  treeCard:    { margin: S.md, borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)' },
  treeCardLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 1 },
  treeIcon:    { fontSize: 80 },
  treeName:    { color: COLORS.surface, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold },
  treeXP:      { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  treeProgressSection: { width: '100%', gap: S.xs },
  treeProgressHeader:  { flexDirection: 'row', justifyContent: 'space-between' },
  treeProgressLabel:   { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  treeProgressValue:   { color: COLORS.secondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  treeProgressBar:     { height: 8, backgroundColor: COLORS.border, borderRadius: R.full, overflow: 'hidden' },
  treeProgressFill:    { height: '100%', backgroundColor: COLORS.secondary, borderRadius: R.full },
  fertBadge:   { backgroundColor: 'rgba(168,224,99,0.15)', borderRadius: R.full, paddingHorizontal: S.lg, paddingVertical: S.xs, borderWidth: 1, borderColor: '#A8E063' },
  fertText:    { color: '#A8E063', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },

  // Nível
  levelCard:   { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.lg, gap: S.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: S.lg },
  xpTodayRow:  { flexDirection: 'row', justifyContent: 'flex-end' },
  xpTodayText: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  // Recompensas de nível
  rewardsContainer:    { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  rewardRow:           { flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rewardRowReceived:   { backgroundColor: 'rgba(76,175,80,0.05)' },
  rewardRowNext:       { backgroundColor: 'rgba(255,215,0,0.08)' },
  rewardStatus:        { fontSize: 22, width: 30, textAlign: 'center' },
  rewardInfo:          { flex: 1 },
  rewardLevel:         { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  rewardLevelReceived: { color: COLORS.success },
  rewardDetail:        { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  rewardValues:        { alignItems: 'flex-end', gap: 2 },
  rewardFragments:     { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  rewardPremium:       { color: '#FFD700', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  rewardsNote:         { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginHorizontal: S.md, marginTop: S.xs, marginBottom: S.lg },

  // Estágios
  sectionTitle:      { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginBottom: S.sm },
  stagesContainer:   { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: S.lg },
  stageRow:          { flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stageRowCompleted: { backgroundColor: 'rgba(76,175,80,0.05)' },
  stageRowCurrent:   { backgroundColor: 'rgba(181,123,238,0.1)' },
  stageIcon:         { fontSize: 28, width: 36 },
  stageInfo:         { flex: 1 },
  stageName:         { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  stageNameCompleted:{ color: COLORS.success },
  stageReward:       { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  stageXP:           { alignItems: 'flex-end', gap: 2 },
  stageXPText:       { color: COLORS.secondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  stageDone:         { fontSize: 14 },

  // Ações
  actionsContainer:  { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: S.lg },
  actionRow:         { flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  actionIcon:        { fontSize: 22, width: 30 },
  actionInfo:        { flex: 1 },
  actionLabel:       { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  actionNote:        { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  actionRewards:     { alignItems: 'flex-end', gap: 2 },
  actionXP:          { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  actionTreeXP:      { color: '#A8E063', fontSize: FONT_SIZE.xs },

  // Fertilizante
  fertCard:    { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.lg, gap: S.sm, borderWidth: 1, borderColor: '#A8E063' + '44' },
  fertTitle:   { color: '#A8E063', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  fertDesc:    { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
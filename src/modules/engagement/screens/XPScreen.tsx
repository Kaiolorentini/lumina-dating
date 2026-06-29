// ============================================
// LUMINA — XP SCREEN v5.1
// src/modules/engagement/screens/XPScreen.tsx
//
// Perfil de progressão: XP, Nível, Árvore da Sintonia
// ============================================

import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { useNavigation }   from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }         from '../../../context/AuthContext';
import { useXP }           from '../hooks/useXP';
import XPBar               from '../../../components/XPBar';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const TREE_GRADIENTS: Record<number, [string, string]> = {
  0: ['#0A1A0A', '#1B2E1B'],
  1: ['#0A1A0A', '#1B3B1B'],
  2: ['#1A0A2E', '#2D1B4E'],
  3: ['#1A1A0A', '#2E2D1B'],
  4: ['#1A0A2E', '#4E1B7E'],
};

const XP_ACTIONS_DISPLAY = [
  { icon: '👁️', action: 'Visitar perfil',          xp: '+1 XP',  treeXP: '',      note: '1x por perfil/dia'       },
  { icon: '💜', action: 'Curtir perfil',            xp: '+3 XP',  treeXP: '',      note: '1x por perfil/dia'       },
  { icon: '💖', action: 'Receber curtida',          xp: '+5 XP',  treeXP: '',      note: 'máx 100 XP/dia'         },
  { icon: '💬', action: 'Iniciar conversa real',    xp: '+10 XP', treeXP: '+5 🌳', note: 'após resposta mútua'    },
  { icon: '✨', action: 'Criar Sintonia',           xp: '+20 XP', treeXP: '+20 🌳', note: 'quando ambos curtiram' },
  { icon: '📋', action: 'Completar missão',        xp: '+15 XP', treeXP: '+5 🌳', note: 'após validação'         },
  { icon: '🏆', action: 'Desbloquear conquista',   xp: '+30 XP', treeXP: '+10 🌳', note: ''                      },
];

const TREE_STAGES_DISPLAY = [
  { stage: 0, icon: '🌱', name: 'Broto',         xp: '0',    reward: '10 Cristais Gratuitos' },
  { stage: 1, icon: '🌿', name: 'Crescimento',   xp: '100',  reward: 'Moldura Nebulosa'      },
  { stage: 2, icon: '🌸', name: 'Florescimento', xp: '300',  reward: 'Badge Flor'            },
  { stage: 3, icon: '✨', name: 'Constelação',   xp: '700',  reward: '30 Cristais Gratuitos' },
  { stage: 4, icon: '💜', name: 'Galáxia',       xp: '1500', reward: 'Animação Exclusiva'    },
];

export default function XPScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { status, loading, error, refresh } = useXP(user?.uid);

  const treeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(treeAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(treeAnim, { toValue: 1,    duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Progressão" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  const treeStage   = status?.treeStage   ?? 0;
  const gradient    = TREE_GRADIENTS[treeStage] ?? TREE_GRADIENTS[0];
  const treeIcon    = status?.treeIcon    ?? '🌱';
  const treeName    = status?.treeName    ?? 'Broto';
  const treeProgress = status?.treeProgress ?? 0;
  const nextStage   = status?.nextTreeStage;

  return (
    <View style={styles.container}>
      <Header title="Progressão & Árvore" showBack={true} showHome={true} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Árvore da Sintonia */}
        <LinearGradient colors={gradient} style={styles.treeCard}>
          <Text style={styles.treeCardLabel}>Árvore da Sintonia</Text>

          <Animated.Text style={[styles.treeIcon, { transform: [{ scale: treeAnim }] }]}>
            {treeIcon}
          </Animated.Text>

          <Text style={styles.treeName}>{treeName}</Text>
          <Text style={styles.treeXP}>
            {status?.treeXP ?? 0} XP da Árvore
          </Text>

          {nextStage && (
            <View style={styles.treeProgressSection}>
              <View style={styles.treeProgressHeader}>
                <Text style={styles.treeProgressLabel}>Próximo: {nextStage.icon} {nextStage.name}</Text>
                <Text style={styles.treeProgressValue}>
                  {status?.treeXP ?? 0}/{nextStage.treeXPMin}
                </Text>
              </View>
              <View style={styles.treeProgressBar}>
                <View style={[styles.treeProgressFill, { width: `${treeProgress * 100}%` as any }]} />
              </View>
            </View>
          )}

          {status?.fertilizanteAtivo && (
            <View style={styles.fertBadge}>
              <Text style={styles.fertText}>🌱 Fertilizante ativo — +50% XP</Text>
            </View>
          )}
        </LinearGradient>

        {/* Nível e XP global */}
        <View style={styles.levelCard}>
          <Text style={styles.sectionTitle}>Seu Nível</Text>
          <XPBar
            level={status?.level ?? 1}
            tier={status?.tier ?? '🌱 Comum'}
            totalXP={status?.totalXP ?? 0}
            nextLevelXP={status?.nextLevelXP ?? 100}
            progress={status?.levelProgress ?? 0}
          />
          <View style={styles.xpTodayRow}>
            <Text style={styles.xpTodayText}>
              XP hoje: {status?.xpToday ?? 0}/{status?.dailyMax ?? 300}
            </Text>
          </View>
        </View>

        {/* Estágios da Árvore */}
        <Text style={styles.sectionTitle}>Estágios da Árvore</Text>
        <View style={styles.stagesContainer}>
          {TREE_STAGES_DISPLAY.map(stage => {
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
                  <Text style={styles.stageReward}>🎁 {stage.reward}</Text>
                </View>
                <View style={styles.stageXP}>
                  <Text style={styles.stageXPText}>{stage.xp} XP</Text>
                  {isCompleted && <Text style={styles.stageDone}>✅</Text>}
                </View>
              </View>
            );
          })}
        </View>

        {/* Como ganhar XP */}
        <Text style={styles.sectionTitle}>Como ganhar XP</Text>
        <View style={styles.actionsContainer}>
          {XP_ACTIONS_DISPLAY.map((item, i) => (
            <View key={i} style={styles.actionRow}>
              <Text style={styles.actionIcon}>{item.icon}</Text>
              <View style={styles.actionInfo}>
                <Text style={styles.actionLabel}>{item.action}</Text>
                {item.note ? <Text style={styles.actionNote}>{item.note}</Text> : null}
              </View>
              <View style={styles.actionRewards}>
                <Text style={styles.actionXP}>{item.xp}</Text>
                {item.treeXP ? <Text style={styles.actionTreeXP}>{item.treeXP}</Text> : null}
              </View>
            </View>
          ))}
        </View>

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
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
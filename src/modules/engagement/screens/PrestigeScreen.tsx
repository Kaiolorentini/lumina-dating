// ============================================
// LUMINA — PRESTIGE SCREEN v5.1
// src/modules/engagement/screens/PrestigeScreen.tsx
//
// Prestígio: reputação e histórico — nunca riqueza.
// Linha do tempo do Legado do usuário.
// ============================================

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { useNavigation }   from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }         from '../../../context/AuthContext';
import { usePrestige }     from '../hooks/usePrestige';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const STAGE_GRADIENTS: Record<number, [string, string]> = {
  0: ['#1A1A1A', '#2D2D2D'],
  1: ['#0A1A0A', '#1B3B1B'],
  2: ['#1A0A12', '#3B1B24'],
  3: ['#1A1A0A', '#2E2D1B'],
  4: ['#1A0A2E', '#4E1B7E'],
};

export default function PrestigeScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { data, loading, error } = usePrestige(user?.uid);

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Prestígio" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  const stage    = data?.prestigeStage  ?? 0;
  const gradient = STAGE_GRADIENTS[stage] ?? STAGE_GRADIENTS[0];
  const color    = data?.prestigeColor  ?? COLORS.textMuted;
  const progress = data?.progress       ?? 0;

  return (
    <View style={styles.container}>
      <Header title="Prestígio" showBack={true} showHome={true} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero do Prestígio */}
        <LinearGradient colors={gradient} style={styles.hero}>
          <Text style={styles.heroIcon}>{data?.prestigeIcon ?? '✨'}</Text>
          <Text style={[styles.heroName, { color }]}>{data?.prestigeName ?? 'Desperto'}</Text>
          <Text style={styles.heroTitle}>"{data?.prestigeTitle ?? 'Desperto'}"</Text>
          <Text style={styles.heroDesc}>{data?.description ?? ''}</Text>

          {/* Pontos e progresso */}
          <View style={styles.pointsRow}>
            <Text style={[styles.points, { color }]}>{data?.prestigePoints ?? 0}</Text>
            <Text style={styles.pointsLabel}>Pontos de Prestígio</Text>
          </View>

          {data?.nextStage && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  Próximo: {data.nextStage.icon} {data.nextStage.name}
                </Text>
                <Text style={[styles.progressValue, { color }]}>
                  +{data.pointsToNext} pts
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[
                  styles.progressFill,
                  { width: `${progress * 100}%` as any, backgroundColor: color },
                ]} />
              </View>
            </View>
          )}

          {!data?.nextStage && (
            <Text style={[styles.maxStage, { color }]}>
              ✦ Estágio máximo atingido ✦
            </Text>
          )}
        </LinearGradient>

        {/* Aviso: Prestígio não é riqueza */}
        <View style={styles.manifesto}>
          <Text style={styles.manifestoTitle}>O que é Prestígio</Text>
          <Text style={styles.manifestoText}>
            Prestígio representa sua história e reputação no Lumina.{'\n'}
            Não pode ser comprado. Não diminui. Não afeta a economia.{'\n'}
            É conquistado apenas através do tempo e das conexões reais.
          </Text>
        </View>

        {/* Todos os estágios */}
        <Text style={styles.sectionTitle}>Jornada do Prestígio</Text>
        <View style={styles.stagesContainer}>
          {[
            { stage: 0, name: 'Desperto',          icon: '✨', pts: '0',    color: '#C0C0C0' },
            { stage: 1, name: 'Guardião',           icon: '🌿', pts: '300',  color: '#A8E063' },
            { stage: 2, name: 'Mentor',             icon: '🌸', pts: '800',  color: '#FF9EBC' },
            { stage: 3, name: 'Constelação',        icon: '🌌', pts: '1800', color: '#FFD700' },
            { stage: 4, name: 'Lenda da Sintonia',  icon: '💜', pts: '4000', color: '#B57BEE' },
          ].map(s => {
            const isReached  = stage >= s.stage;
            const isCurrent  = stage === s.stage;
            return (
              <View key={s.stage} style={[
                styles.stageRow,
                isReached && styles.stageRowReached,
                isCurrent && styles.stageRowCurrent,
              ]}>
                <Text style={styles.stageIcon}>{s.icon}</Text>
                <View style={styles.stageInfo}>
                  <Text style={[styles.stageName, isReached && { color: s.color }]}>
                    {s.name}
                  </Text>
                  <Text style={styles.stageReq}>{s.pts} pontos</Text>
                </View>
                {isReached && <Text style={[styles.stageDone, { color: s.color }]}>✓</Text>}
                {isCurrent && !isReached && <Text style={styles.stageCurrent}>← atual</Text>}
              </View>
            );
          })}
        </View>

        {/* Legado — linha do tempo (REGRA 12) */}
        {data?.legado && data.legado.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Seu Legado</Text>
            <View style={styles.legadoContainer}>
              {[...data.legado].reverse().map((entry, i) => (
                <View key={i} style={styles.legadoItem}>
                  <View style={styles.legadoDot} />
                  <View style={styles.legadoContent}>
                    <Text style={styles.legadoLabel}>{entry.label}</Text>
                    <Text style={styles.legadoPoints}>+{entry.points} pts</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Como ganhar pontos */}
        <Text style={styles.sectionTitle}>Como ganhar Pontos de Prestígio</Text>
        <View style={styles.marcosContainer}>
          {[
            { cat: '⏳ Tempo',       items: ['30 dias ativos (+100)', '90 dias ativos (+250)', '1 ano ativo (+1000)'] },
            { cat: '✨ Social',      items: ['10 sintonias reais (+80)', '50 sintonias reais (+200)', '100 sintonias (+400)'] },
            { cat: '🌱 Árvore',     items: ['Florescimento (+150)', 'Constelação (+250)', 'Galáxia (+600)'] },
            { cat: '📚 Coleções',   items: ['1ª Coleção Ouro (+150)', '3 Coleções Ouro (+300)'] },
            { cat: '🏆 Conquistas', items: ['Conquista Fundador (+500)', 'Sequência 30 dias (+100)'] },
          ].map((group, i) => (
            <View key={i} style={styles.marcoGroup}>
              <Text style={styles.marcoGroupTitle}>{group.cat}</Text>
              {group.items.map((item, j) => (
                <Text key={j} style={styles.marcoItem}>• {item}</Text>
              ))}
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Hero
  hero:         { margin: S.md, borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)' },
  heroIcon:     { fontSize: 80 },
  heroName:     { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold },
  heroTitle:    { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontStyle: 'italic' },
  heroDesc:     { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center', lineHeight: 18 },
  pointsRow:    { alignItems: 'center', gap: 4 },
  points:       { fontSize: 48, fontWeight: FONT_WEIGHT.extrabold },
  pointsLabel:  { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 1 },
  progressSection: { width: '100%', gap: S.xs },
  progressHeader:  { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel:   { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  progressValue:   { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  progressBar:     { height: 8, backgroundColor: COLORS.border, borderRadius: R.full, overflow: 'hidden' },
  progressFill:    { height: '100%', borderRadius: R.full },
  maxStage:     { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },

  // Manifesto
  manifesto:    { marginHorizontal: S.md, backgroundColor: 'rgba(123,47,190,0.08)', borderRadius: R.lg, padding: S.lg, borderWidth: 1, borderColor: 'rgba(123,47,190,0.2)', marginBottom: S.md },
  manifestoTitle: { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  manifestoText:  { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, lineHeight: 22 },

  // Estágios
  sectionTitle:      { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginBottom: S.sm },
  stagesContainer:   { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: S.lg },
  stageRow:          { flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stageRowReached:   { backgroundColor: 'rgba(76,175,80,0.05)' },
  stageRowCurrent:   { backgroundColor: 'rgba(181,123,238,0.08)' },
  stageIcon:         { fontSize: 28, width: 36 },
  stageInfo:         { flex: 1 },
  stageName:         { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  stageReq:          { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  stageDone:         { fontSize: 18, fontWeight: FONT_WEIGHT.bold },
  stageCurrent:      { color: COLORS.secondary, fontSize: FONT_SIZE.xs },

  // Legado
  legadoContainer:   { marginHorizontal: S.md, marginBottom: S.lg },
  legadoItem:        { flexDirection: 'row', alignItems: 'flex-start', gap: S.md, marginBottom: S.md },
  legadoDot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.secondary, marginTop: 4 },
  legadoContent:     { flex: 1 },
  legadoLabel:       { color: COLORS.surface, fontSize: FONT_SIZE.sm },
  legadoPoints:      { color: COLORS.secondary, fontSize: FONT_SIZE.xs, marginTop: 2 },

  // Marcos
  marcosContainer:   { marginHorizontal: S.md, gap: S.md, marginBottom: S.lg },
  marcoGroup:        { backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: COLORS.border },
  marcoGroupTitle:   { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  marcoItem:         { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, lineHeight: 20 },
});
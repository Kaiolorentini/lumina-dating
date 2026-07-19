// ============================================
// LUMINA — PRESTIGE SCREEN v5.2
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
import { Card } from '../../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, PRESTIGE_STAGES, PRESTIGE_COLORS, GRADIENTS } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

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
  const gradient = (GRADIENTS.prestige[PRESTIGE_STAGES[stage]?.name.toLowerCase() as keyof typeof GRADIENTS.prestige] ?? GRADIENTS.prestige.desperado) as [string, string];
  const color    = data?.prestigeColor  ?? PRESTIGE_COLORS.desperado;
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
        <Card padding={S.lg} style={{ marginHorizontal: S.md, borderWidth: 1, borderColor: COLORS.secondary + '33', marginBottom: S.md, backgroundColor: COLORS.secondary + '14' }}>
          <Text style={styles.manifestoTitle}>O que é Prestígio</Text>
          <Text style={styles.manifestoText}>
            Prestígio representa sua história e reputação no Lumina.{'\n'}
            Não pode ser comprado. Não diminui. Não afeta a economia.{'\n'}
            É conquistado apenas através do tempo e das conexões reais.
          </Text>
        </Card>

        {/* Todos os estágios */}
        <Text style={styles.sectionTitle}>Jornada do Prestígio</Text>
        <Card padding={0} style={{ marginHorizontal: S.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: S.lg }}>
          {PRESTIGE_STAGES.map(s => {
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
        </Card>

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
            <Card key={i} padding={S.md} style={{ borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={styles.marcoGroupTitle}>{group.cat}</Text>
              {group.items.map((item, j) => (
                <Text key={j} style={styles.marcoItem}>• {item}</Text>
              ))}
            </Card>
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
  hero:         { margin: S.md, borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, borderWidth: 1, borderColor: COLORS.borderLight },
  heroIcon:     { fontSize: 80 },
  heroName:     { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold },
  heroTitle:    { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontStyle: 'italic' },
  heroDesc:     { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center', lineHeight: 18 },
  pointsRow:    { alignItems: 'center', gap: S.xs },
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
  manifestoTitle: { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  manifestoText:  { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, lineHeight: 22 },

  // Estágios
  sectionTitle:      { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginBottom: S.sm },
  stageRow:          { flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stageRowReached:   { backgroundColor: COLORS.success + '0D' },
  stageRowCurrent:   { backgroundColor: COLORS.secondary + '14' },
  stageIcon:         { fontSize: FONT_SIZE.hero, width: 36 },
  stageInfo:         { flex: 1 },
  stageName:         { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  stageReq:          { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  stageDone:         { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
  stageCurrent:      { color: COLORS.secondary, fontSize: FONT_SIZE.xs },

  // Legado
  legadoContainer:   { marginHorizontal: S.md, marginBottom: S.lg },
  legadoItem:        { flexDirection: 'row', alignItems: 'flex-start', gap: S.md, marginBottom: S.md },
  legadoDot:         { width: 10, height: 10, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.secondary, marginTop: 4 },
  legadoContent:     { flex: 1 },
  legadoLabel:       { color: COLORS.surface, fontSize: FONT_SIZE.sm },
  legadoPoints:      { color: COLORS.secondary, fontSize: FONT_SIZE.xs, marginTop: 2 },

  // Marcos
  marcosContainer:   { marginHorizontal: S.md, gap: S.md, marginBottom: S.lg },
  marcoGroupTitle:   { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  marcoItem:         { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, lineHeight: 20 },
});
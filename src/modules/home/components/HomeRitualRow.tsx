// ============================================
// LUMINA — RITUAL DO DIA (HOME DO COMPUTADOR)
// src/modules/home/components/HomeRitualRow.tsx
//
// Só no computador (HomeScreen escolhe pela useBreakpoint). As quatro
// faixas empilhadas do celular (Faísca, Carta, Missões, Cofre) viram
// quatro cartões lado a lado — o "ritual" que a pessoa fecha todo dia.
// Missões mostra o progresso real (useMissionsSummary, que a Home já
// usa). Nada é lido aqui: só recebe números e ações.
// ============================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../../theme';
import HoverPressable from '../../../components/web/HoverPressable';

interface Props {
  missionsCompleted: number;
  missionsTotal:     number;
  onFaisca:   () => void;
  onDestiny:  () => void;
  onMissions: () => void;
  onVault:    () => void;
}

interface TileProps {
  icon:      string;
  title:     string;
  subtitle?: string;
  counter?:  string;
  progress?: number;
  tone:      'purple' | 'neutral' | 'gold';
  onPress:   () => void;
  a11y:      string;
}

const TONES = {
  purple:  { bg: '#1F1530', border: '#4A2A7A', iconBg: '#2D1B4E', title: '#C9A0F5', bar: '#C9A0F5', track: '#2D1B4E' },
  neutral: { bg: colors.surface, border: '#333333', iconBg: '#262626', title: colors.white, bar: colors.gold, track: colors.surfaceOverlay },
  gold:    { bg: '#1E150A', border: '#6B5212', iconBg: '#2A1E0C', title: colors.goldLight, bar: colors.goldLight, track: '#2A1E0C' },
} as const;

function Tile({ icon, title, subtitle, counter, progress, tone, onPress, a11y }: TileProps) {
  const t = TONES[tone];
  return (
    <HoverPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={[styles.tile, { backgroundColor: t.bg, borderColor: t.border }]}
      hoverStyle={styles.tileHover}
      pressedStyle={styles.tilePressed}
    >
      <View style={styles.tileTop}>
        <View style={[styles.iconBox, { backgroundColor: t.iconBg }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        {counter ? <Text style={[styles.counter, { color: t.title }]}>{counter}</Text> : null}
      </View>
      <Text style={[styles.title, { color: t.title }]} numberOfLines={1}>{title}</Text>
      {progress !== undefined ? (
        <View style={[styles.track, { backgroundColor: t.track }]}>
          <View style={[styles.bar, { backgroundColor: t.bar, width: `${Math.round(progress * 100)}%` }]} />
        </View>
      ) : (
        <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
      )}
    </HoverPressable>
  );
}

export default function HomeRitualRow({
  missionsCompleted, missionsTotal, onFaisca, onDestiny, onMissions, onVault,
}: Props) {
  const hasMissions = missionsTotal > 0;
  const done = hasMissions && missionsCompleted >= missionsTotal;
  const progress = hasMissions ? Math.min(1, missionsCompleted / missionsTotal) : undefined;

  return (
    <View style={styles.row} accessibilityLabel="Ritual do dia">
      <Tile
        icon="⚡" tone="purple" title="Faísca do Destino"
        subtitle="Toque para revelar a surpresa de hoje"
        onPress={onFaisca} a11y="Faísca do Destino: revelar a surpresa de hoje"
      />
      <Tile
        icon="🃏" tone="purple" title="Carta do Destino"
        subtitle="Duas pessoas esperam por você. Escolha uma."
        onPress={onDestiny} a11y="Carta do Destino: escolher entre duas pessoas"
      />
      <Tile
        icon={done ? '✅' : '📋'} tone="neutral"
        title={done ? 'Missões concluídas' : 'Missões do Dia'}
        counter={hasMissions ? `${missionsCompleted}/${missionsTotal}` : undefined}
        progress={progress}
        subtitle="Veja as missões de hoje"
        onPress={onMissions}
        a11y={hasMissions ? `Missões do dia: ${missionsCompleted} de ${missionsTotal} concluídas` : 'Missões do dia'}
      />
      <Tile
        icon="🗝️" tone="gold" title="Cofre de Sintonia"
        subtitle="Recompensas por atividade social"
        onPress={onVault} a11y="Cofre de Sintonia: recompensas por atividade social"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14 },
  tile: {
    flex: 1, minWidth: 0, gap: 10, padding: 18,
    borderRadius: 18, borderWidth: 1,
  },
  tileHover:   { transform: [{ translateY: -2 }], borderColor: colors.gold },
  tilePressed: { opacity: 0.85 },
  tileTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBox:  { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon:     { fontSize: 20 },
  counter:  { fontSize: 13, fontWeight: 'bold' },
  title:    { fontSize: 15, fontWeight: 'bold' },
  subtitle: { color: colors.textSecondary, fontSize: fonts.sizes.sm, lineHeight: 17 },
  track:    { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  bar:      { height: 6, borderRadius: 3 },
});

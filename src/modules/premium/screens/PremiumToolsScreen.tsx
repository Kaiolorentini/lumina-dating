// ============================================
// LUMINA — PREMIUM TOOLS SCREEN v5.1
// src/modules/premium/screens/PremiumToolsScreen.tsx
//
// Ferramentas Premium — não poder, mas conveniência.
// Status calculado server-side — cliente só exibe.
// ============================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { useNavigation }   from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }          from '../../../context/AuthContext';
import { usePremiumTools }  from '../hooks/usePremiumTools';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function formatTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    LOCKED:   { label: 'Bloqueado',   color: '#888'    },
    READY:    { label: 'Disponível',  color: '#A8E063' },
    ACTIVE:   { label: 'Ativo',       color: '#56CCF2' },
    EXPIRED:  { label: 'Expirado',    color: '#888'    },
    COOLDOWN: { label: 'Cooldown',    color: '#FFD700' },
  };
  const cfg = config[status] ?? config.LOCKED;
  return (
    <View style={[styles.statusBadge, { borderColor: cfg.color }]}>
      <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

export default function PremiumToolsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const {
    fertilizer, turbo, loading, activating, error,
    activateFertilizer, activateTurbo, refresh,
  } = usePremiumTools(user?.uid);

  async function handleActivateFertilizer() {
    Alert.alert(
      '🌱 Ativar Fertilizante?',
      `Gasta ${fertilizer?.cost ?? 80} Cristais Premium.\n+50% XP por 24 horas.\n\nNão pode ser cancelado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ativar',
          onPress: async () => {
            const ok = await activateFertilizer();
            if (ok) Alert.alert('✅ Ativado!', 'Fertilizante da Sintonia ativo por 24h.');
          },
        },
      ]
    );
  }

  async function handleActivateTurbo() {
    Alert.alert(
      '⚡ Ativar Turbo?',
      `Gasta ${turbo?.cost ?? 120} Cristais Premium.\nBoost de visibilidade por 30 minutos.\n\nNão garante aparecer — apenas aumenta a chance.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ativar',
          onPress: async () => {
            const ok = await activateTurbo();
            if (ok) Alert.alert('✅ Ativado!', 'Turbo Sintonia ativo por 30 minutos.');
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Ferramentas Premium" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Ferramentas Premium" showBack={true} showHome={true} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Aviso filosófico */}
        <View style={styles.manifesto}>
          <Text style={styles.manifestoText}>
            💎 Ferramentas Premium oferecem conveniência e aceleração.{'\n'}
            Nunca substituem o esforço. Nunca garantem resultados.
          </Text>
        </View>

        {/* ── FERTILIZANTE DA SINTONIA ── */}
        <LinearGradient
          colors={fertilizer?.isActive ? ['#0A1A0A', '#1B3B1B'] : ['#1A0A2E', '#2D1B4E']}
          style={styles.toolCard}
        >
          <View style={styles.toolHeader}>
            <Text style={styles.toolIcon}>🌱</Text>
            <View style={styles.toolInfo}>
              <Text style={styles.toolName}>Fertilizante da Sintonia</Text>
              <Text style={styles.toolDesc}>+50% XP por 24 horas reais</Text>
            </View>
            <StatusBadge status={fertilizer?.status ?? 'LOCKED'} />
          </View>

          {fertilizer?.isActive && (
            <View style={styles.activeInfo}>
              <Text style={styles.activeLabel}>⏳ Restam</Text>
              <Text style={styles.activeTime}>{formatTime(fertilizer.remainingMs)}</Text>
              <Text style={styles.activeMult}>Multiplicador: {fertilizer.xpMultiplier}x</Text>
            </View>
          )}

          <View style={styles.toolDetails}>
            <Text style={styles.toolDetail}>✓ Afeta apenas XP global e XP da Árvore</Text>
            <Text style={styles.toolDetail}>✗ Não afeta Fragmentos, Cristais ou Cofre</Text>
            <Text style={styles.toolDetail}>✗ Não afeta Ranking Social ou Prestígio</Text>
            <Text style={styles.toolDetail}>✗ Não acumula — apenas 1 ativo por vez</Text>
          </View>

          {!fertilizer?.isActive && (
            <TouchableOpacity
              style={[
                styles.activateBtn,
                (fertilizer?.status === 'LOCKED' || activating === 'FERTILIZER') && styles.activateBtnDisabled,
              ]}
              onPress={handleActivateFertilizer}
              disabled={fertilizer?.status === 'LOCKED' || activating === 'FERTILIZER'}
            >
              {activating === 'FERTILIZER'
                ? <ActivityIndicator color={COLORS.background} />
                : <Text style={styles.activateBtnText}>
                    💎 {fertilizer?.cost ?? 80} Cristais Premium — Ativar
                  </Text>
              }
            </TouchableOpacity>
          )}

          {fertilizer?.status === 'LOCKED' && (
            <TouchableOpacity
              style={styles.buyBtn}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Store' } as any)}
            >
              <Text style={styles.buyBtnText}>Comprar Cristais Premium →</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* ── TURBO SINTONIA ── */}
        <LinearGradient
          colors={turbo?.isActive ? ['#0A0A1A', '#1B1B3B'] : ['#1A0A2E', '#2D1B4E']}
          style={styles.toolCard}
        >
          <View style={styles.toolHeader}>
            <Text style={styles.toolIcon}>⚡</Text>
            <View style={styles.toolInfo}>
              <Text style={styles.toolName}>Turbo Sintonia</Text>
              <Text style={styles.toolDesc}>Boost de visibilidade por 30 minutos</Text>
            </View>
            <StatusBadge status={turbo?.status ?? 'LOCKED'} />
          </View>

          {turbo?.isActive && (
            <View style={styles.activeInfo}>
              <Text style={styles.activeLabel}>⏳ Restam</Text>
              <Text style={styles.activeTime}>{formatTime(turbo.remainingMs)}</Text>
              <Text style={styles.activeMult}>Boost Score: {turbo.boostScore}</Text>
            </View>
          )}

          {turbo?.inCooldown && (
            <View style={styles.cooldownInfo}>
              <Text style={styles.cooldownText}>
                Cooldown: {formatTime(turbo.cooldownMs)}
              </Text>
            </View>
          )}

          <View style={styles.toolDetails}>
            <Text style={styles.toolDetail}>✓ Aumenta chance de aparecer para outros</Text>
            <Text style={styles.toolDetail}>✗ Nunca garante aparecer — algoritmo decide</Text>
            <Text style={styles.toolDetail}>✗ Não afeta Ranking, Prestígio ou Conquistas</Text>
            <Text style={styles.toolDetail}>✗ Cooldown de 5 min entre ativações</Text>
          </View>

          {!turbo?.isActive && !turbo?.inCooldown && (
            <TouchableOpacity
              style={[
                styles.activateBtn,
                (turbo?.status === 'LOCKED' || activating === 'TURBO') && styles.activateBtnDisabled,
              ]}
              onPress={handleActivateTurbo}
              disabled={turbo?.status === 'LOCKED' || activating === 'TURBO'}
            >
              {activating === 'TURBO'
                ? <ActivityIndicator color={COLORS.background} />
                : <Text style={styles.activateBtnText}>
                    💎 {turbo?.cost ?? 120} Cristais Premium — Ativar
                  </Text>
              }
            </TouchableOpacity>
          )}

          {turbo?.status === 'LOCKED' && (
            <TouchableOpacity
              style={styles.buyBtn}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Store' } as any)}
            >
              <Text style={styles.buyBtnText}>Comprar Cristais Premium →</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

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

  manifesto:    { margin: S.md, backgroundColor: 'rgba(123,47,190,0.1)', borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: 'rgba(123,47,190,0.3)' },
  manifestoText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },

  toolCard:     { margin: S.md, borderRadius: R.xl, padding: S.lg, gap: S.md, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)' },
  toolHeader:   { flexDirection: 'row', alignItems: 'center', gap: S.md },
  toolIcon:     { fontSize: 36 },
  toolInfo:     { flex: 1 },
  toolName:     { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  toolDesc:     { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 2 },

  statusBadge:  { borderRadius: R.full, borderWidth: 1, paddingHorizontal: S.sm, paddingVertical: 2 },
  statusText:   { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },

  activeInfo:   { backgroundColor: 'rgba(86,204,242,0.1)', borderRadius: R.lg, padding: S.md, alignItems: 'center', gap: S.xs },
  activeLabel:  { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  activeTime:   { color: '#56CCF2', fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold },
  activeMult:   { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  cooldownInfo: { backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: R.lg, padding: S.sm, alignItems: 'center' },
  cooldownText: { color: '#FFD700', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },

  toolDetails:  { gap: S.xs },
  toolDetail:   { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, lineHeight: 18 },

  activateBtn:  { backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center' },
  activateBtnDisabled: { opacity: 0.4 },
  activateBtnText: { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },

  buyBtn:       { alignItems: 'center', paddingVertical: S.sm },
  buyBtnText:   { color: '#FFD700', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },

  errorCard:    { marginHorizontal: S.md, backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: '#FF6B6B' },
  errorText:    { color: '#FF6B6B', fontSize: FONT_SIZE.sm, textAlign: 'center' },
});
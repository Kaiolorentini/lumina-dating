// ============================================
// LUMINA — DAILY REWARD SCREEN v5.1
// src/modules/engagement/screens/DailyRewardScreen.tsx
//
// Tela de Recompensa Diária com streak visual.
// Nunca credita client-side — apenas exibe resultado da CF.
// ============================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation }  from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }          from '../../../context/AuthContext';
import { useCoins }         from '../../../context/CoinsContext';
import { useDailyReward, DailyRewardResult }   from '../hooks/useDailyReward';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const STREAK_LABELS: Record<number, string> = {
  1: 'Dia 1',
  2: 'Dia 2',
  3: 'Dia 3',
  4: 'Dia 4',
  5: 'Dia 5',
  6: 'Dia 6',
  7: '🌟 Dia 7',
};

const STREAK_ICONS: Record<number, string> = {
  1: '✨',
  2: '✨',
  3: '⚡',
  4: '⚡',
  5: '💜',
  6: '💜',
  7: '👑',
};

export default function DailyRewardScreen() {
  const navigation        = useNavigation<NavProp>();
  const { user }          = useAuth();
  const { refreshWallet } = useCoins();
  const { status, loading, claiming, claimReward } = useDailyReward(user?.uid);
  const [claimResult, setClaimResult] = useState<DailyRewardResult | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  async function handleClaim() {
    const result = await claimReward();
    if (result) {
      setClaimResult(result);
      setShowSuccess(true);
      await refreshWallet(); // atualiza saldo na UI
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Recompensa Diária" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  // ── TELA DE SUCESSO ──
  if (showSuccess && claimResult) {
    return (
      <View style={styles.container}>
        <Header title="Recompensa Diária" showBack={false} showHome={true} />
        <LinearGradient colors={['#1A0A2E', '#0D0D1A']} style={styles.successContainer}>
          <Text style={styles.successIcon}>✨</Text>
          <Text style={styles.successTitle}>Recompensa Resgatada!</Text>
          <Text style={styles.successCrystals}>+{claimResult.crystals} Cristais Gratuitos</Text>

          {claimResult.currentStreak > 1 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakBadgeText}>
                🔥 {claimResult.currentStreak} dias seguidos!
              </Text>
            </View>
          )}

          {claimResult.currentStreak === 7 && (
            <View style={styles.maxStreakBanner}>
              <Text style={styles.maxStreakText}>
                👑 Sequência máxima atingida! Parabéns!
              </Text>
            </View>
          )}

          <Text style={styles.nextDayLabel}>
            Amanhã: +{claimResult.nextReward} cristais
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('MainTabs')}
          >
            <Text style={styles.primaryBtnText}>Continuar explorando ✦</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  // ── TELA PRINCIPAL ──
  const streak       = status?.currentStreak ?? 0;
  const todayReward  = status?.todayReward   ?? 5;
  const alreadyClaimed = status?.alreadyClaimed ?? false;

  return (
    <View style={styles.container}>
      <Header title="Recompensa Diária" showBack={true} showHome={true} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1A0A2E', '#2D1B4E']} style={styles.heroCard}>
          <Text style={styles.heroIcon}>
            {alreadyClaimed ? '✅' : STREAK_ICONS[Math.min(streak + 1, 7)]}
          </Text>
          <Text style={styles.heroTitle}>
            {alreadyClaimed ? 'Volte amanhã!' : 'Sua recompensa de hoje'}
          </Text>

          {!alreadyClaimed && (
            <View style={styles.crystalDisplay}>
              <Text style={styles.crystalAmount}>+{todayReward}</Text>
              <Text style={styles.crystalLabel}>Cristais Gratuitos</Text>
            </View>
          )}

          {streak > 0 && (
            <View style={styles.streakRow}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakText}>
                {streak} {streak === 1 ? 'dia' : 'dias'} seguido{streak !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Grade de streak — 7 dias */}
        <Text style={styles.sectionTitle}>Sequência de Login</Text>
        <View style={styles.streakGrid}>
          {[1, 2, 3, 4, 5, 6, 7].map(day => {
            const isCompleted = day <= streak;
            const isToday     = day === streak + 1 && !alreadyClaimed;
            const isPast      = day < streak + 1;
            const reward      = status?.streakRewards?.[day] ?? 5;

            return (
              <View
                key={day}
                style={[
                  styles.streakDay,
                  isCompleted && styles.streakDayCompleted,
                  isToday     && styles.streakDayToday,
                ]}
              >
                <Text style={styles.streakDayIcon}>
                  {isCompleted ? '✅' : STREAK_ICONS[day]}
                </Text>
                <Text style={[
                  styles.streakDayLabel,
                  isCompleted && styles.streakDayLabelCompleted,
                  isToday     && styles.streakDayLabelToday,
                ]}>
                  {STREAK_LABELS[day]}
                </Text>
                <Text style={[
                  styles.streakDayReward,
                  isCompleted && styles.streakDayRewardCompleted,
                ]}>
                  +{reward}✨
                </Text>
              </View>
            );
          })}
        </View>

        {/* Stats */}
        {status && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{status.currentStreak}</Text>
              <Text style={styles.statLabel}>Streak atual</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{status.longestStreak}</Text>
              <Text style={styles.statLabel}>Recorde</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{status.totalClaimed ?? 0}</Text>
              <Text style={styles.statLabel}>Total ganho</Text>
            </View>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Como funciona</Text>
          <Text style={styles.infoText}>
            • Entre todo dia para acumular sua sequência
          </Text>
          <Text style={styles.infoText}>
            • Após 48h sem login, a sequência reinicia
          </Text>
          <Text style={styles.infoText}>
            • Dia 7 = bônus especial de 25 cristais 👑
          </Text>
          <Text style={styles.infoText}>
            • Cristais gratuitos expiram em 30 dias
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Botão fixo de resgate */}
      {!alreadyClaimed && (
        <View style={styles.claimContainer}>
          <TouchableOpacity
            style={[styles.claimBtn, claiming && styles.claimBtnDisabled]}
            onPress={handleClaim}
            disabled={claiming}
            activeOpacity={0.85}
          >
            {claiming ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.claimBtnText}>
                ✨ Resgatar {todayReward} Cristais
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {alreadyClaimed && (
        <View style={styles.claimContainer}>
          <View style={styles.alreadyClaimedBadge}>
            <Text style={styles.alreadyClaimedText}>
              ✅ Recompensa resgatada hoje — volte amanhã!
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Hero
  heroCard:    { margin: S.md, borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)' },
  heroIcon:    { fontSize: 56 },
  heroTitle:   { color: COLORS.surface, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  crystalDisplay: { alignItems: 'center', gap: S.xs },
  crystalAmount:  { color: COLORS.secondary, fontSize: FONT_SIZE.hero, fontWeight: FONT_WEIGHT.extrabold },
  crystalLabel:   { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textTransform: 'uppercase', letterSpacing: 1 },
  streakRow:   { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.xs },
  streakFire:  { fontSize: 20 },
  streakText:  { color: COLORS.secondary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },

  // Grade streak
  sectionTitle: { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginTop: S.lg, marginBottom: S.sm },
  streakGrid:   { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: S.md, gap: S.sm, marginBottom: S.lg },
  streakDay:    { width: '13%', minWidth: 44, backgroundColor: COLORS.card, borderRadius: R.md, padding: S.sm, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.border },
  streakDayCompleted: { borderColor: COLORS.success, backgroundColor: 'rgba(76,175,80,0.1)' },
  streakDayToday:     { borderColor: COLORS.secondary, backgroundColor: 'rgba(181,123,238,0.15)' },
  streakDayIcon:      { fontSize: 20 },
  streakDayLabel:     { color: COLORS.textMuted, fontSize: 9, textAlign: 'center' },
  streakDayLabelCompleted: { color: COLORS.success },
  streakDayLabelToday:     { color: COLORS.secondary, fontWeight: FONT_WEIGHT.bold },
  streakDayReward:         { color: COLORS.textMuted, fontSize: 9, fontWeight: FONT_WEIGHT.semibold },
  streakDayRewardCompleted: { color: COLORS.success },

  // Stats
  statsRow:  { flexDirection: 'row', marginHorizontal: S.md, gap: S.sm, marginBottom: S.lg },
  statCard:  { flex: 1, backgroundColor: COLORS.card, borderRadius: R.md, padding: S.md, alignItems: 'center', gap: S.xs, borderWidth: 1, borderColor: COLORS.border },
  statValue: { color: COLORS.secondary, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold },
  statLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },

  // Info
  infoCard:  { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.lg, gap: S.sm, borderWidth: 1, borderColor: COLORS.border },
  infoTitle: { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  infoText:  { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, lineHeight: 20 },

  // Botão de resgate fixo
  claimContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: S.md, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.border },
  claimBtn:        { backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center' },
  claimBtnDisabled: { opacity: 0.6 },
  claimBtnText:    { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5 },
  alreadyClaimedBadge: { backgroundColor: 'rgba(76,175,80,0.15)', borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.success },
  alreadyClaimedText:  { color: COLORS.success, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },

  // Sucesso
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.lg, padding: S.xl },
  successIcon:      { fontSize: 80 },
  successTitle:     { color: COLORS.surface, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold, textAlign: 'center' },
  successCrystals:  { color: COLORS.secondary, fontSize: FONT_SIZE.hero, fontWeight: FONT_WEIGHT.extrabold },
  streakBadge:      { backgroundColor: 'rgba(255,152,0,0.2)', borderRadius: R.full, paddingHorizontal: S.lg, paddingVertical: S.sm, borderWidth: 1, borderColor: '#FF9800' },
  streakBadgeText:  { color: '#FF9800', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  maxStreakBanner:  { backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: COLORS.premium },
  maxStreakText:    { color: COLORS.premium, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  nextDayLabel:     { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  primaryBtn:       { backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.md, paddingHorizontal: S.xl, marginTop: S.sm },
  primaryBtnText:   { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
});
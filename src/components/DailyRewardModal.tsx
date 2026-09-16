// ============================================
// LUMINA — DAILY REWARD MODAL v5.2
// src/components/DailyRewardModal.tsx
//
// v5.2: progressMission('claim_daily') chamado após resgate.
// ============================================

import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useDailyReward } from '../modules/engagement/hooks/useDailyReward';
import { useCoins }       from '../context/CoinsContext';
import { todayBrUnderscore } from '../utils/dateBr';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme/tokens';

interface Props {
  uid:     string;
  visible: boolean;
  onClose: () => void;
}

const fns = getFunctions();

const STREAK_ICONS: Record<number, string> = {
  1: '✨', 2: '✨', 3: '⚡', 4: '⚡', 5: '💜', 6: '💜', 7: '👑',
};

export default function DailyRewardModal({ uid, visible, onClose }: Props) {
  const { status, loading, claiming, claimReward } = useDailyReward(uid);
  const { refreshWallet } = useCoins();
  const [claimed, setClaimed] = useState(false);
  const [result,  setResult]  = useState<{ crystals: number; streak: number } | null>(null);

  async function handleClaim() {
    const res = await claimReward();
    if (res) {
      setResult({ crystals: res.crystals, streak: res.currentStreak });
      setClaimed(true);
      await refreshWallet();

      // v5.2 — registra progresso da missão claim_daily (fire-and-forget)
      const missionId = `daily_${todayBrUnderscore()}_claim_daily`;
      httpsCallable(fns, 'progressMission')({ missionIdParam: missionId }).catch(() => {});

      // v5.3 — conquista STREAK_UPDATE (fire-and-forget)
      if (res.currentStreak >= 3) {
        httpsCallable(fns, 'checkAchievements')({
          action:       'STREAK_UPDATE',
          currentValue: res.currentStreak,
        }).catch(() => {});
      }
    }
  }

  if (!visible) return null;

  const streak      = status?.currentStreak ?? 0;
  const todayReward = status?.todayReward   ?? 5;
  const icon        = STREAK_ICONS[Math.min(streak + 1, 7)];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <LinearGradient colors={['#1A0A2E','#2D1B4E']} style={styles.card}>
          {loading ? (
            <ActivityIndicator color={COLORS.secondary} size="large" />
          ) : claimed && result ? (
            <>
              <Text style={styles.icon}>✨</Text>
              <Text style={styles.title}>Recompensa resgatada!</Text>
              <Text style={styles.crystalAmount}>+{result.crystals}</Text>
              <Text style={styles.crystalLabel}>Cristais Gratuitos</Text>
              {result.streak > 1 && (
                <View style={styles.streakBadge}>
                  <Text style={styles.streakText}>🔥 {result.streak} dias seguidos!</Text>
                </View>
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>Continuar ✦</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.icon}>{icon}</Text>
              <Text style={styles.title}>Recompensa Diária</Text>
              <Text style={styles.subtitle}>Seu presente de hoje</Text>
              <View style={styles.crystalBox}>
                <Text style={styles.crystalAmount}>+{todayReward}</Text>
                <Text style={styles.crystalLabel}>Cristais Gratuitos</Text>
              </View>
              {streak > 0 && (
                <View style={styles.streakBadge}>
                  <Text style={styles.streakText}>🔥 {streak} dias seguidos</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.claimBtn, claiming && styles.claimBtnDisabled]}
                onPress={handleClaim}
                disabled={claiming}
                activeOpacity={0.85}
              >
                {claiming
                  ? <ActivityIndicator color={COLORS.background} />
                  : <Text style={styles.claimBtnText}>✨ Resgatar agora</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.laterBtn} onPress={onClose}>
                <Text style={styles.laterBtnText}>Mais tarde</Text>
              </TouchableOpacity>
            </>
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: S.xl },
  card:             { width: '100%', borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, borderWidth: 1, borderColor: 'rgba(181,123,238,0.4)' },
  icon:             { fontSize: 64 },
  title:            { color: COLORS.surface, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold, textAlign: 'center' },
  subtitle:         { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textTransform: 'uppercase', letterSpacing: 1 },
  crystalBox:       { alignItems: 'center', gap: S.xs },
  crystalAmount:    { color: COLORS.secondary, fontSize: FONT_SIZE.hero, fontWeight: FONT_WEIGHT.extrabold },
  crystalLabel:     { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textTransform: 'uppercase', letterSpacing: 1 },
  streakBadge:      { backgroundColor: 'rgba(255,152,0,0.2)', borderRadius: R.full, paddingHorizontal: S.lg, paddingVertical: S.xs, borderWidth: 1, borderColor: '#FF9800' },
  streakText:       { color: '#FF9800', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  claimBtn:         { width: '100%', backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center', marginTop: S.sm },
  claimBtnDisabled: { opacity: 0.6 },
  claimBtnText:     { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  closeBtn:         { width: '100%', backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center', marginTop: S.sm },
  closeBtnText:     { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  laterBtn:         { paddingVertical: S.sm },
  laterBtnText:     { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
});
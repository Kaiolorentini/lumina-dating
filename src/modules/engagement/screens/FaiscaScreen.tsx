// ============================================
// LUMINA — FAÍSCA DO DESTINO SCREEN v5.2
// src/modules/engagement/screens/FaiscaScreen.tsx
//
// v5.2: progressMission('claim_faisca') chamado após resgate.
// ============================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation }  from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth }         from '../../../context/AuthContext';
import { useCoins }        from '../../../context/CoinsContext';
import { useFaisca, FaiscaTier } from '../hooks/useFaisca';
import { RootStackParamList }    from '../../../navigation/types';
import Header from '../../../components/Header';
import { todayBrUnderscore } from '../../../utils/dateBr';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const fns = getFunctions();

const TIER_CONFIG: Record<FaiscaTier, {
  icon:      string;
  label:     string;
  color:     string;
  gradient:  [string, string];
  message:   string;
  particles: string;
}> = {
  common:    { icon: '✨', label: 'Faísca Comum',  color: COLORS.secondary, gradient: ['#1A0A2E','#2D1B4E'], message: 'Uma faísca acendeu seu caminho.',         particles: '✦ ✦ ✦' },
  rare:      { icon: '⚡', label: 'Faísca Rara',   color: '#56CCF2',        gradient: ['#0A1A2E','#1B3D4E'], message: 'Energia cósmica encontrou você!',           particles: '⚡ ✦ ⚡' },
  epic:      { icon: '💜', label: 'Faísca Épica',  color: '#B57BEE',        gradient: ['#2A0A4E','#4E1B7E'], message: 'O universo está do seu lado hoje!',         particles: '💜 ✨ 💜' },
  legendary: { icon: '👑', label: 'LENDÁRIA!',     color: '#FFD700',        gradient: ['#2E1A00','#4E3200'], message: '✦ Evento Raro — Conte para alguém! ✦',   particles: '👑 ✨ 👑' },
};

// Fire-and-forget: registra progresso da missão claim_faisca
function notifyMissionProgress(uid: string, missionId: string) {
  const fn = httpsCallable(fns, 'progressMission');
  fn({ missionIdParam: missionId }).catch(() => { /* silencioso */ });
}

export default function FaiscaScreen() {
  const navigation        = useNavigation<NavProp>();
  const { user }          = useAuth();
  const { refreshWallet } = useCoins();
  const { status, loading, claiming, claimFaisca } = useFaisca(user?.uid);

  const [revealed, setRevealed] = useState(false);
  const [result, setResult]     = useState<{ crystals: number; tier: FaiscaTier } | null>(null);

  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (revealed) {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim,   { toValue: 1, tension: 50, friction: 3, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1,   duration: 1200, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
          ])
        ),
      ]).start();
    }
  }, [revealed]);

  async function handleClaim() {
    const res = await claimFaisca();
    if (res) {
      setResult(res);
      setRevealed(true);
      await refreshWallet();

      // v5.2 — registra progresso da missão claim_faisca (fire-and-forget)
      if (user?.uid) {
        notifyMissionProgress(user.uid, `daily_${todayBrUnderscore()}_claim_faisca`);
      }
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Faísca do Destino" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  const alreadyClaimed = status?.alreadyClaimed ?? false;
  const cfg = result ? TIER_CONFIG[result.tier] : TIER_CONFIG.common;

  // ── TELA DE REVELAÇÃO ──
  if (revealed && result) {
    const glowOpacity = glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.3,1] });
    return (
      <View style={styles.container}>
        <Header title="Faísca do Destino" showBack={false} showHome={true} />
        <LinearGradient colors={cfg.gradient} style={styles.revealContainer}>
          <Text style={[styles.particles, { color: cfg.color }]}>{cfg.particles}</Text>
          <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
            <Animated.View style={[styles.iconGlow, { backgroundColor: cfg.color + '33', opacity: glowOpacity }]} />
            <Text style={styles.mainIcon}>{cfg.icon}</Text>
          </Animated.View>
          <Animated.Text style={[styles.tierLabel, { color: cfg.color, opacity: opacityAnim }]}>
            {cfg.label}
          </Animated.Text>
          <Animated.View style={[styles.crystalDisplay, { opacity: opacityAnim }]}>
            <Text style={[styles.crystalAmount, { color: cfg.color }]}>+{result.crystals}</Text>
            <Text style={styles.crystalLabel}>Cristais Gratuitos</Text>
          </Animated.View>
          <Animated.Text style={[styles.emotionalMessage, { color: cfg.color + 'CC', opacity: opacityAnim }]}>
            {cfg.message}
          </Animated.Text>
          {result.tier === 'legendary' && (
            <View style={styles.legendaryBanner}>
              <Text style={styles.legendaryText}>
                50 Cristais de uma vez é extremamente raro.{'\n'}Você tem sorte cósmica hoje! ✦
              </Text>
            </View>
          )}
          <Text style={styles.particles}>{cfg.particles}</Text>
          <TouchableOpacity style={[styles.continueBtn, { backgroundColor: cfg.color }]} onPress={() => navigation.navigate('MainTabs')}>
            <Text style={styles.continueBtnText}>Continuar explorando ✦</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  // ── TELA PRINCIPAL ──
  return (
    <View style={styles.container}>
      <Header title="Faísca do Destino" showBack={true} showHome={true} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1A0A2E','#2D1B4E']} style={styles.heroCard}>
          <Text style={styles.heroIcon}>{alreadyClaimed ? '✅' : '⚡'}</Text>
          <Text style={styles.heroTitle}>{alreadyClaimed ? 'Até amanhã!' : 'Sua Faísca de hoje'}</Text>
          <Text style={styles.heroSubtitle}>
            {alreadyClaimed ? 'Você já resgatou sua Faísca hoje.' : 'O universo tem uma surpresa para você.'}
          </Text>
          {!alreadyClaimed && (
            <TouchableOpacity
              style={[styles.claimBtn, claiming && styles.claimBtnDisabled]}
              onPress={handleClaim}
              disabled={claiming}
              activeOpacity={0.85}
            >
              {claiming
                ? <ActivityIndicator color={COLORS.background} />
                : <Text style={styles.claimBtnText}>⚡ Acender Faísca</Text>
              }
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* Tabela de probabilidades */}
        <View style={styles.probCard}>
          <Text style={styles.probTitle}>Probabilidades</Text>
          {[
            { tier: 'Comum ✨',   chance: '50%', crystals: '2–5',  color: COLORS.secondary },
            { tier: 'Rara ⚡',    chance: '30%', crystals: '8–12', color: '#56CCF2' },
            { tier: 'Épica 💜',   chance: '15%', crystals: '15–20',color: '#B57BEE' },
            { tier: 'Lendária 👑',chance: '5%',  crystals: '50',   color: '#FFD700' },
          ].map(row => (
            <View key={row.tier} style={styles.probRow}>
              <Text style={[styles.probTier,   { color: row.color }]}>{row.tier}</Text>
              <Text style={[styles.probChance, { color: row.color }]}>{row.chance}</Text>
              <Text style={[styles.probCrystals,{ color: row.color }]}>{row.crystals} cristais</Text>
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
  container:        { flex: 1, backgroundColor: COLORS.background },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  revealContainer:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl, gap: S.lg },
  particles:        { fontSize: 28, letterSpacing: 8 },
  iconContainer:    { position: 'relative', alignItems: 'center', justifyContent: 'center', width: 160, height: 160 },
  iconGlow:         { position: 'absolute', width: 160, height: 160, borderRadius: 80 },
  mainIcon:         { fontSize: 80 },
  tierLabel:        { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold, textAlign: 'center' },
  crystalDisplay:   { alignItems: 'center', gap: S.xs },
  crystalAmount:    { fontSize: 64, fontWeight: FONT_WEIGHT.extrabold },
  crystalLabel:     { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textTransform: 'uppercase', letterSpacing: 1 },
  emotionalMessage: { fontSize: FONT_SIZE.md, textAlign: 'center', fontStyle: 'italic' },
  legendaryBanner:  { backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: '#FFD700' },
  legendaryText:    { color: '#FFD700', fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  continueBtn:      { borderRadius: R.lg, paddingVertical: S.md, paddingHorizontal: S.xl },
  continueBtnText:  { color: COLORS.background, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  heroCard:         { margin: S.md, borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)' },
  heroIcon:         { fontSize: 64 },
  heroTitle:        { color: COLORS.surface, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold },
  heroSubtitle:     { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center' },
  claimBtn:         { backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.md, paddingHorizontal: S.xl, marginTop: S.md },
  claimBtnDisabled: { opacity: 0.6 },
  claimBtnText:     { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  probCard:         { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.lg, gap: S.sm, borderWidth: 1, borderColor: COLORS.border },
  probTitle:        { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  probRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: S.xs },
  probTier:         { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium, flex: 1 },
  probChance:       { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, width: 40, textAlign: 'center' },
  probCrystals:     { fontSize: FONT_SIZE.sm, width: 90, textAlign: 'right' },
});
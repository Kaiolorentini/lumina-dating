// ============================================
// LUMINA — FAÍSCA DO DESTINO SCREEN v5.1
// src/modules/engagement/screens/FaiscaScreen.tsx
//
// Tela de revelação da Faísca com efeito emocional.
// Tier: common → rare → epic → legendary
// Prêmio de 50 cristais vira história (memória emocional).
// ============================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation }  from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }         from '../../../context/AuthContext';
import { useCoins }        from '../../../context/CoinsContext';
import { useFaisca, FaiscaTier } from '../hooks/useFaisca';
import { RootStackParamList }    from '../../../navigation/types';
import Header from '../../../components/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Config visual por tier
const TIER_CONFIG: Record<FaiscaTier, {
  icon:       string;
  label:      string;
  color:      string;
  gradient:   [string, string];
  message:    string;
  particles:  string;
}> = {
  common: {
    icon:      '✨',
    label:     'Faísca Comum',
    color:     COLORS.secondary,
    gradient:  ['#1A0A2E', '#2D1B4E'],
    message:   'Uma faísca acendeu seu caminho.',
    particles: '✦ ✦ ✦',
  },
  rare: {
    icon:      '⚡',
    label:     'Faísca Rara',
    color:     '#56CCF2',
    gradient:  ['#0A1A2E', '#1B3D4E'],
    message:   'Energia cósmica encontrou você!',
    particles: '⚡ ✦ ⚡',
  },
  epic: {
    icon:      '💜',
    label:     'Faísca Épica',
    color:     '#B57BEE',
    gradient:  ['#2A0A4E', '#4E1B7E'],
    message:   'O universo está do seu lado hoje!',
    particles: '💜 ✨ 💜',
  },
  legendary: {
    icon:      '👑',
    label:     'LENDÁRIA!',
    color:     '#FFD700',
    gradient:  ['#2E1A00', '#4E3200'],
    message:   '✦ Evento Raro — Conte para alguém! ✦',
    particles: '👑 ✨ 👑',
  },
};

export default function FaiscaScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { refreshWallet } = useCoins();
  const { status, loading, claiming, claimFaisca } = useFaisca(user?.uid);

  const [revealed, setRevealed]   = useState(false);
  const [result, setResult]       = useState<{ crystals: number; tier: FaiscaTier } | null>(null);

  // Animações
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (revealed) {
      // Sequência de animação ao revelar
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1, tension: 50, friction: 3, useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1, duration: 400, useNativeDriver: true,
          }),
        ]),
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
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
    const glowOpacity = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    });

    return (
      <View style={styles.container}>
        <Header title="Faísca do Destino" showBack={false} showHome={true} />
        <LinearGradient colors={cfg.gradient} style={styles.revealContainer}>

          {/* Partículas animadas */}
          <Text style={[styles.particles, { color: cfg.color }]}>{cfg.particles}</Text>

          {/* Ícone principal */}
          <Animated.View style={[
            styles.iconContainer,
            {
              transform: [{ scale: scaleAnim }],
              opacity:   opacityAnim,
            }
          ]}>
            <Animated.View style={[
              styles.iconGlow,
              { backgroundColor: cfg.color + '33', opacity: glowOpacity }
            ]} />
            <Text style={styles.mainIcon}>{cfg.icon}</Text>
          </Animated.View>

          {/* Tier label */}
          <Animated.Text style={[
            styles.tierLabel,
            { color: cfg.color, opacity: opacityAnim }
          ]}>
            {cfg.label}
          </Animated.Text>

          {/* Cristais ganhos */}
          <Animated.View style={[styles.crystalDisplay, { opacity: opacityAnim }]}>
            <Text style={[styles.crystalAmount, { color: cfg.color }]}>
              +{result.crystals}
            </Text>
            <Text style={styles.crystalLabel}>Cristais Gratuitos</Text>
          </Animated.View>

          {/* Mensagem emocional */}
          <Animated.Text style={[
            styles.emotionalMessage,
            { color: cfg.color + 'CC', opacity: opacityAnim }
          ]}>
            {cfg.message}
          </Animated.Text>

          {/* Mensagem especial para lendário */}
          {result.tier === 'legendary' && (
            <View style={styles.legendaryBanner}>
              <Text style={styles.legendaryText}>
                50 Cristais de uma vez é extremamente raro.{'\n'}
                Você tem sorte cósmica hoje! ✦
              </Text>
            </View>
          )}

          <Text style={styles.particles}>{cfg.particles}</Text>

          <TouchableOpacity
            style={[styles.continueBtn, { backgroundColor: cfg.color }]}
            onPress={() => navigation.navigate('MainTabs')}
          >
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
        <LinearGradient colors={['#1A0A2E', '#2D1B4E']} style={styles.heroCard}>
          <Text style={styles.heroIcon}>
            {alreadyClaimed ? '✅' : '⚡'}
          </Text>
          <Text style={styles.heroTitle}>
            {alreadyClaimed ? 'Até amanhã!' : 'Sua Faísca de hoje'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {alreadyClaimed
              ? 'Você já resgatou sua Faísca hoje.'
              : 'O universo tem uma surpresa para você.'}
          </Text>

          {!alreadyClaimed && (
            <View style={styles.mysteryBox}>
              <Text style={styles.mysteryIcon}>❓</Text>
              <Text style={styles.mysteryText}>
                Entre 2 e 50 Cristais aguardam você
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Tabela de probabilidades */}
        <Text style={styles.sectionTitle}>Possíveis Prêmios</Text>
        <View style={styles.probabilityTable}>
          {[
            { value: 2,  prob: '60%', tier: 'common',    icon: '✨', label: 'Comum'    },
            { value: 5,  prob: '25%', tier: 'common',    icon: '✨', label: 'Incomum'  },
            { value: 10, prob: '10%', tier: 'rare',      icon: '⚡', label: 'Rara'     },
            { value: 20, prob: '4%',  tier: 'epic',      icon: '💜', label: 'Épica'    },
            { value: 50, prob: '1%',  tier: 'legendary', icon: '👑', label: 'Lendária' },
          ].map(row => (
            <View key={row.value} style={[
              styles.probRow,
              row.tier === 'legendary' && styles.probRowLegendary,
            ]}>
              <Text style={styles.probIcon}>{row.icon}</Text>
              <Text style={styles.probLabel}>{row.label}</Text>
              <Text style={styles.probValue}>+{row.value} ✨</Text>
              <Text style={[
                styles.probChance,
                row.tier === 'legendary' && { color: COLORS.premium },
              ]}>
                {row.prob}
              </Text>
            </View>
          ))}
        </View>

        {/* Histórico */}
        {status && status.claimsCount > 0 && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Seu histórico</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{status.claimsCount}</Text>
                <Text style={styles.statLabel}>Faíscas</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{status.totalClaimed}</Text>
                <Text style={styles.statLabel}>Cristais ganhos</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {status.claimsCount > 0
                    ? (status.totalClaimed / status.claimsCount).toFixed(1)
                    : '0'}
                </Text>
                <Text style={styles.statLabel}>Média/dia</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Botão fixo */}
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
              <Text style={styles.claimBtnText}>⚡ Acender Faísca</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {alreadyClaimed && (
        <View style={styles.claimContainer}>
          <View style={styles.alreadyClaimedBadge}>
            <Text style={styles.alreadyClaimedText}>
              ✅ Faísca resgatada — volte amanhã!
            </Text>
            {status?.lastValue && (
              <Text style={styles.alreadyClaimedSub}>
                Ontem: +{status.lastValue} cristais
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Hero
  heroCard:     { margin: S.md, borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)' },
  heroIcon:     { fontSize: 56 },
  heroTitle:    { color: COLORS.surface, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold, textAlign: 'center' },
  heroSubtitle: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center' },
  mysteryBox:   { backgroundColor: 'rgba(181,123,238,0.15)', borderRadius: R.lg, padding: S.md, alignItems: 'center', gap: S.xs, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)', width: '100%' },
  mysteryIcon:  { fontSize: 32 },
  mysteryText:  { color: COLORS.secondary, fontSize: FONT_SIZE.sm, textAlign: 'center', fontWeight: FONT_WEIGHT.medium },

  // Tabela
  sectionTitle:    { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginTop: S.lg, marginBottom: S.sm },
  probabilityTable: { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: S.lg },
  probRow:         { flexDirection: 'row', alignItems: 'center', padding: S.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: S.sm },
  probRowLegendary: { backgroundColor: 'rgba(255,215,0,0.05)' },
  probIcon:        { fontSize: 20, width: 28 },
  probLabel:       { color: COLORS.surface, fontSize: FONT_SIZE.sm, flex: 1, fontWeight: FONT_WEIGHT.medium },
  probValue:       { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, width: 60, textAlign: 'right' },
  probChance:      { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, width: 36, textAlign: 'right' },

  // Stats
  statsCard:    { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: S.lg },
  statsTitle:   { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: S.md },
  statsRow:     { flexDirection: 'row', justifyContent: 'space-around' },
  statItem:     { alignItems: 'center', gap: S.xs },
  statValue:    { color: COLORS.secondary, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold },
  statLabel:    { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },

  // Botão
  claimContainer:     { position: 'absolute', bottom: 0, left: 0, right: 0, padding: S.md, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.border },
  claimBtn:           { backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center' },
  claimBtnDisabled:   { opacity: 0.6 },
  claimBtnText:       { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5 },
  alreadyClaimedBadge: { backgroundColor: 'rgba(76,175,80,0.1)', borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.success, gap: S.xs },
  alreadyClaimedText: { color: COLORS.success, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  alreadyClaimedSub:  { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },

  // Revelação
  revealContainer:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl, gap: S.lg },
  particles:          { fontSize: 24, letterSpacing: 8 },
  iconContainer:      { position: 'relative', alignItems: 'center', justifyContent: 'center', width: 140, height: 140 },
  iconGlow:           { position: 'absolute', width: 140, height: 140, borderRadius: 70 },
  mainIcon:           { fontSize: 80 },
  tierLabel:          { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold, letterSpacing: 2, textTransform: 'uppercase' },
  crystalDisplay:     { alignItems: 'center', gap: S.xs },
  crystalAmount:      { fontSize: FONT_SIZE.hero, fontWeight: FONT_WEIGHT.extrabold },
  crystalLabel:       { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textTransform: 'uppercase', letterSpacing: 1 },
  emotionalMessage:   { fontSize: FONT_SIZE.md, textAlign: 'center', fontStyle: 'italic' },
  legendaryBanner:    { backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: COLORS.premium },
  legendaryText:      { color: COLORS.premium, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  continueBtn:        { borderRadius: R.lg, paddingVertical: S.md, paddingHorizontal: S.xl, marginTop: S.sm },
  continueBtnText:    { color: COLORS.background, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
});
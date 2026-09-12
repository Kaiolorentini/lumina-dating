// ============================================
// LUMINA — MISSIONS SCREEN v5.3
// src/modules/engagement/screens/MissionsScreen.tsx
//
// v5.3: correção do bug onde handleMissionPress só navegava
// sem nunca chamar progressMission. Lógica unificada:
// — Missões de ação direta → progressMission()
// — Missões de outra tela → navega (progresso registrado lá)
// — Missões mistas → navega + toast orientando
// ============================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { useNavigation }   from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }          from '../../../context/AuthContext';
import { useCoins }         from '../../../context/CoinsContext';
import { useMissions, CommonMission, SpecialMission } from '../hooks/useMissions';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Missões que têm progresso registrado NA OUTRA TELA ao executar a ação.
// Aqui só navegamos — não chamamos progressMission.
const NAVIGATE_ONLY_MISSIONS = new Set([
  'open_destiny',   // registrado em DestinyCardScreen ao abrir
  'claim_faisca',   // registrado em FaiscaScreen ao resgatar
  'claim_daily',    // registrado em DailyRewardModal ao resgatar
  'create_sintonia',// registrado pelo trigger de match
  'receive_like',   // registrado pelo trigger de curtida recebida
  'long_chat',      // registrado pelo trigger de mensagens
  'send_message',   // registrado pelo trigger de mensagem enviada
  'visit_profiles', // registrado pelo trigger de visita
  'like_profiles',  // registrado pelo trigger de curtida
]);

// Destino de navegação por tipo de missão
function getNavDestination(type: string): (() => void) | null {
  return null; // resolvido dentro do componente com acesso ao navigation
}

// ── Card missão comum ──────────────────────────────────────────────
function CommonMissionCard({
  mission,
  onPress,
  loading,
}: {
  mission: CommonMission;
  onPress: () => void;
  loading: boolean;
}) {
  const pct = mission.target > 1
    ? mission.progress / mission.target
    : mission.completed ? 1 : 0;

  return (
    <TouchableOpacity
      style={[styles.card, mission.completed && styles.cardDone]}
      onPress={onPress}
      activeOpacity={mission.completed ? 1 : 0.85}
      disabled={mission.completed || loading}
    >
      <View style={[styles.cardIcon, mission.completed && styles.cardIconDone]}>
        <Text style={styles.cardIconText}>{mission.completed ? '✅' : mission.icon}</Text>
      </View>

      <View style={styles.cardInfo}>
        <Text style={[styles.cardLabel, mission.completed && styles.cardLabelDone]}>
          {mission.label}
        </Text>
        {!mission.completed && mission.target > 1 && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct * 100}%` as any }]} />
          </View>
        )}
        <Text style={styles.cardSub}>
          {mission.completed ? 'Concluída! ✓' : `${mission.progress}/${mission.target} ${mission.unit}`}
        </Text>
      </View>

      <View style={[styles.reward, mission.completed && styles.rewardDone]}>
        <Text style={[styles.rewardValue, mission.completed && styles.rewardValueDone]}>
          +{mission.fragments}
        </Text>
        <Text style={styles.rewardUnit}>🔮</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Card missão especial ───────────────────────────────────────────
function SpecialMissionCard({
  mission,
  onPress,
  loading,
}: {
  mission: SpecialMission;
  onPress: () => void;
  loading: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.specialCard, mission.completed && styles.cardDone]}
      onPress={onPress}
      activeOpacity={mission.completed ? 1 : 0.85}
      disabled={mission.completed || loading}
    >
      <LinearGradient
        colors={mission.completed ? ['#0A2E0A', '#1B4E1B'] : ['#2A0A4E', '#4E1B7E']}
        style={styles.specialInner}
      >
        <Text style={styles.specialBadge}>⭐ MISSÃO ESPECIAL</Text>
        <View style={styles.specialContent}>
          <Text style={styles.specialIcon}>{mission.completed ? '✅' : mission.icon}</Text>
          <View style={styles.specialInfo}>
            <Text style={styles.specialLabel}>{mission.label}</Text>
            <Text style={styles.specialSub}>
              {mission.completed ? 'Concluída!' : `${mission.progress}/${mission.target}`}
            </Text>
          </View>
          <View style={styles.specialReward}>
            <Text style={styles.specialRewardValue}>+{mission.crystals}</Text>
            <Text style={styles.specialRewardUnit}>✨ cristal</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── Tela principal ─────────────────────────────────────────────────
export default function MissionsScreen() {
  const navigation                = useNavigation<NavProp>();
  const { user }                  = useAuth();
  const { refreshWallet }         = useCoins();
  const {
    data, loading, error,
    progressing, progressMission, refresh,
  } = useMissions(user?.uid);

  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // Destino de navegação por tipo — centralizado
  function navigateByType(type: string) {
    const map: Record<string, () => void> = {
      visit_profiles:   () => navigation.navigate('MainTabs'),
      like_profiles:    () => navigation.navigate('MainTabs'),
      view_media:       () => navigation.navigate('MainTabs'),
      receive_like:     () => navigation.navigate('MainTabs'),
      send_message:     () => navigation.navigate('MainTabs', { screen: 'Sintonias' } as any),
      long_chat:        () => navigation.navigate('MainTabs', { screen: 'Sintonias' } as any),
      create_sintonia:  () => navigation.navigate('MainTabs', { screen: 'Sintonias' } as any),
      open_destiny:     () => navigation.navigate('DestinyCard' as any),
      claim_faisca:     () => navigation.navigate('Faisca' as any),
      claim_daily:      () => navigation.navigate('MainTabs'),
      update_profile:   () => navigation.navigate('ProfileSetup'),
      complete_profile: () => navigation.navigate('ProfileSetup'),
    };
    map[type]?.();
  }

  // ── Lógica unificada de press ──────────────────────────────────
  // Missões NAVIGATE_ONLY: progresso registrado na outra tela → só navega.
  // Missões diretas (update_profile, complete_profile, view_media):
  //   → chama progressMission E navega.
  async function handleMissionPress(missionId: string, type: string) {
    if (NAVIGATE_ONLY_MISSIONS.has(type)) {
      // Navega e mostra dica — progresso é automático ao executar a ação
      navigateByType(type);
      return;
    }

    // Missões que registramos progresso aqui diretamente
    const result = await progressMission({ missionIdParam: missionId });
    if (!result) return;

    if (result.duplicate) {
      showToast('Já contamos essa ação hoje!');
      return;
    }

    if (result.completed) {
      await refreshWallet();
      if (result.fragments > 0) showToast(`+${result.fragments} 🔮 Fragmentos!`);
      if (result.crystals  > 0) showToast(`+${result.crystals} ✨ Cristal(is) Gratuito(s)!`);
    } else {
      // Progrediu mas não concluiu ainda — navega para a ação
      navigateByType(type);
    }
  }

  // ── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Missões do Dia" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Missões do Dia" showBack={true} showHome={true} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const missions        = data?.missions ?? [];
  const special         = data?.special;
  const completedCommon = missions.filter(m => m.completed).length;
  const fragments       = data?.fragments ?? 0;
  const earned          = data?.fragmentsEarnedToday ?? 0;

  return (
    <View style={styles.container}>
      <Header title="Missões do Dia" showBack={true} showHome={true} />

      {/* Toast */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <LinearGradient colors={['#1A0A2E', '#2D1B4E']} style={styles.hero}>
          <Text style={styles.heroTitle}>📋 Missões de hoje</Text>
          <Text style={styles.heroSub}>
            {completedCommon}/{missions.length} missões comuns concluídas
          </Text>
          <View style={styles.heroProgress}>
            <View style={[styles.heroFill, {
              width: missions.length > 0
                ? `${(completedCommon / missions.length) * 100}%` as any
                : '0%',
            }]} />
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{fragments}</Text>
              <Text style={styles.heroStatLabel}>🔮 Fragmentos</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{earned}</Text>
              <Text style={styles.heroStatLabel}>Ganhos hoje</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{Math.floor(fragments / 100)}</Text>
              <Text style={styles.heroStatLabel}>✨ Conversíveis</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Missão especial */}
        {special && (
          <>
            <Text style={styles.sectionTitle}>Missão Especial do Dia</Text>
            <View style={styles.section}>
              <SpecialMissionCard
                mission={special}
                loading={progressing === special.missionId}
                onPress={() => handleMissionPress(special.missionId, special.type)}
              />
            </View>
          </>
        )}

        {/* Missões comuns */}
        <Text style={styles.sectionTitle}>Missões Comuns</Text>
        <View style={styles.section}>
          {missions.map(mission => (
            <CommonMissionCard
              key={mission.missionId}
              mission={mission}
              loading={progressing === mission.missionId}
              onPress={() => handleMissionPress(mission.missionId, mission.type)}
            />
          ))}
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🔮 Sobre os Fragmentos</Text>
          <Text style={styles.infoText}>• Missões comuns pagam Fragmentos de Sintonia</Text>
          <Text style={styles.infoText}>• Missão especial paga 1 Cristal Gratuito diretamente</Text>
          <Text style={styles.infoText}>• 100 Fragmentos = 1 Cristal Gratuito (converter na tela de Cristais)</Text>
          <Text style={styles.infoText}>• Fragmentos expiram 10% a cada 7 dias sem converter</Text>
          <Text style={styles.infoText}>• Limite: 300 fragmentos/dia · 5 cristais/dia via missões</Text>
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
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md },
  errorText:   { color: COLORS.textMuted, fontSize: FONT_SIZE.md, textAlign: 'center' },
  retryBtn:    { backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.sm, paddingHorizontal: S.xl },
  retryBtnText: { color: COLORS.surface, fontWeight: FONT_WEIGHT.bold },

  toast:     { position: 'absolute', top: 80, alignSelf: 'center', backgroundColor: COLORS.primary, borderRadius: R.full, paddingVertical: S.sm, paddingHorizontal: S.lg, zIndex: 999 },
  toastText: { color: COLORS.surface, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },

  hero:         { margin: S.md, borderRadius: R.xl, padding: S.xl, gap: S.sm, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)' },
  heroTitle:    { color: COLORS.surface, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extrabold },
  heroSub:      { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  heroProgress: { height: 8, backgroundColor: COLORS.border, borderRadius: R.full, overflow: 'hidden' },
  heroFill:     { height: '100%', backgroundColor: COLORS.secondary, borderRadius: R.full },
  heroStats:    { flexDirection: 'row', justifyContent: 'space-around', marginTop: S.sm },
  heroStat:     { alignItems: 'center', gap: 2 },
  heroStatValue: { color: COLORS.secondary, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extrabold },
  heroStatLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },

  sectionTitle: { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginTop: S.lg, marginBottom: S.sm },
  section:      { marginHorizontal: S.md, gap: S.sm, marginBottom: S.sm },

  card:         { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.md, gap: S.md, borderWidth: 1, borderColor: COLORS.border },
  cardDone:     { borderColor: COLORS.success, backgroundColor: 'rgba(76,175,80,0.05)' },
  cardIcon:     { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(123,47,190,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.secondary },
  cardIconDone: { backgroundColor: 'rgba(76,175,80,0.2)', borderColor: COLORS.success },
  cardIconText: { fontSize: 22 },
  cardInfo:     { flex: 1, gap: 4 },
  cardLabel:    { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  cardLabelDone: { color: COLORS.textMuted },
  progressBar:  { height: 4, backgroundColor: COLORS.border, borderRadius: R.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.secondary, borderRadius: R.full },
  cardSub:      { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  reward:       { alignItems: 'center', gap: 2 },
  rewardDone:   { opacity: 0.4 },
  rewardValue:  { color: COLORS.secondary, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extrabold },
  rewardValueDone: { color: COLORS.textMuted },
  rewardUnit:   { fontSize: 14 },

  specialCard:    { marginBottom: S.xs, borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.premium },
  specialInner:   { padding: S.lg, gap: S.sm },
  specialBadge:   { color: COLORS.premium, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extrabold, letterSpacing: 1 },
  specialContent: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  specialIcon:    { fontSize: 32 },
  specialInfo:    { flex: 1 },
  specialLabel:   { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  specialSub:     { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  specialReward:  { alignItems: 'center' },
  specialRewardValue: { color: COLORS.premium, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extrabold },
  specialRewardUnit:  { color: COLORS.premium, fontSize: FONT_SIZE.xs },

  infoCard:  { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.lg, gap: S.sm, borderWidth: 1, borderColor: COLORS.border, marginTop: S.sm },
  infoTitle: { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  infoText:  { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
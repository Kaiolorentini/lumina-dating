// ============================================
// LUMINA — VAULT SCREEN v5.3
// src/modules/engagement/screens/VaultScreen.tsx
//
// Cofre de Sintonia — recompensa atividade social.
// Status: EMPTY / FILLING / READY / FULL
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { useNavigation }   from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }         from '../../../context/AuthContext';
import { useCoins }        from '../../../context/CoinsContext';
import { useVault, VaultStatus } from '../hooks/useVault';
import { RootStackParamList }    from '../../../navigation/types';
import Header from '../../../components/Header';
import { Button, Card } from '../../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, GRADIENTS, RARITY_COLORS , colors } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function formatTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} minutos`;
}

const STATUS_CONFIG: Record<VaultStatus, {
  icon:      string;
  label:     string;
  color:     string;
  gradient:  [string, string];
  message:   string;
}> = {
  EMPTY:   { icon: '🗝️', label: 'Vazio',      color: COLORS.textMuted, gradient: GRADIENTS.vaultStates.empty as [string, string], message: 'Interaja com outros usuários para encher o Cofre.' },
  FILLING: { icon: '🔮', label: 'Enchendo',   color: COLORS.secondary, gradient: GRADIENTS.vaultStates.filling as [string, string], message: 'Continue interagindo para encher o Cofre.' },
  READY:   { icon: '✨', label: 'Pronto!',    color: colors.successLegacy,        gradient: GRADIENTS.vaultStates.ready as [string, string], message: 'Você tem cristais para resgatar!' },
  FULL:    { icon: '👑', label: 'Cheio!',     color: RARITY_COLORS.legendary, gradient: GRADIENTS.vaultStates.claimed as [string, string], message: 'Cofre cheio! Resgate agora para continuar acumulando.' },
};

export default function VaultScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { refreshWallet } = useCoins();
  const { data, loading, withdrawing, error, withdraw, refresh } = useVault(user?.uid);

  const [withdrawResult, setWithdrawResult] = useState<{ crystals: number } | null>(null);
  const [cooldownLeft,   setCooldownLeft]   = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulsação para cofre cheio/pronto
  useEffect(() => {
    if (data?.status === 'READY' || data?.status === 'FULL') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [data?.status]);

  // Countdown do cooldown
  useEffect(() => {
    if (!data?.cooldownRemainingMs) return;
    setCooldownLeft(data.cooldownRemainingMs);
    const interval = setInterval(() => {
      setCooldownLeft(prev => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [data?.cooldownRemainingMs]);

  async function handleWithdraw() {
    const result = await withdraw();
    if (result) {
      setWithdrawResult({ crystals: result.crystalsGained });
      await refreshWallet();
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Cofre de Sintonia" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  const status  = data?.status  ?? 'EMPTY';
  const cfg     = STATUS_CONFIG[status];
  const pct     = data?.vaultPercent ?? 0;

  return (
    <View style={styles.container}>
      <Header title="Cofre de Sintonia" showBack={true} showHome={true} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero Cofre */}
        <LinearGradient colors={cfg.gradient} style={styles.hero}>
          <Animated.Text style={[styles.heroIcon, { transform: [{ scale: pulseAnim }] }]}>
            {cfg.icon}
          </Animated.Text>

          <View style={[styles.statusBadge, { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}>
            <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>

          <Text style={[styles.vaultFragments, { color: cfg.color }]}>
            {data?.vaultFragments ?? 0}
          </Text>
          <Text style={styles.vaultFragmentsLabel}>fragmentos no cofre</Text>

          {/* Barra de progresso */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Capacidade</Text>
              <Text style={[styles.progressValue, { color: cfg.color }]}>
                {data?.vaultFragments ?? 0}/{data?.vaultMax ?? 5000}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[
                styles.progressFill,
                { width: `${pct}%` as any, backgroundColor: cfg.color },
              ]} />
            </View>
          </View>

          {/* Cristais equivalentes */}
          <View style={styles.equivalentRow}>
            <Text style={styles.equivalentText}>
              = {data?.crystalsEquivalent ?? 0} ✨ cristais disponíveis para saque
            </Text>
          </View>

          <Text style={styles.hintText}>{cfg.message}</Text>
        </LinearGradient>

        {/* Resultado de saque */}
        {withdrawResult && (
          <View style={styles.resultCard}>
            <Text style={styles.resultIcon}>✨</Text>
            <Text style={styles.resultText}>
              +{withdrawResult.crystals} Cristal{withdrawResult.crystals > 1 ? 'is' : ''} Gratuito{withdrawResult.crystals > 1 ? 's' : ''}!
            </Text>
          </View>
        )}

        {/* Botão de saque */}
        <View style={styles.withdrawSection}>

          {/* Galáxia Plus — saque imediato */}
          {data?.isGalaxiaPlus && (
            <View style={styles.galaxiaBadge}>
              <Text style={styles.galaxiaBadgeText}>💜 Galáxia Plus — Saque Imediato</Text>
            </View>
          )}

          {/* Cooldown ativo */}
          {data?.isLocked && cooldownLeft > 0 && !withdrawResult && (
            <Card padding={S.md} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={styles.cooldownIcon}>⏳</Text>
              <View>
                <Text style={styles.cooldownText}>
                  Disponível em {formatTime(cooldownLeft)}
                </Text>
                <Text style={styles.cooldownSub}>
                  Galáxia Plus libera saque imediato
                </Text>
              </View>
            </Card>
          )}

          {/* Limite diário */}
          {(data?.crystalsToday ?? 0) > 0 && (
            <Text style={styles.dailyInfo}>
              Saques hoje: {data?.crystalsToday}/{data?.dailyLimit} cristais
            </Text>
          )}

          <Button
            icon={<Text style={{ fontSize: FONT_SIZE.lg }}>{cfg.icon}</Text>}
            label={data?.canWithdraw
              ? `Sacar ${data.crystalsEquivalent} Cristal${data.crystalsEquivalent !== 1 ? 'is' : ''}`
              : data?.status === 'EMPTY' || data?.status === 'FILLING'
                ? 'Cofre ainda enchendo...'
                : 'Aguardando desbloqueio'}
            onPress={handleWithdraw}
            loading={withdrawing}
            disabled={!data?.canWithdraw || withdrawing}
            variant={data?.status === 'FULL' ? 'premium' : 'primary'}
            fullWidth
          />

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {/* Como encher o Cofre */}
        <Text style={styles.sectionTitle}>Como encher o Cofre</Text>
        <Card padding={0} style={{ marginHorizontal: S.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: S.lg }}>
          {[
            { icon: '👁️', action: 'Receber visita no perfil',  reward: '+2 🔮', note: '1x por visitante/dia'  },
            { icon: '💜', action: 'Receber uma curtida',        reward: '+5 🔮', note: '1x por usuário/dia'    },
            { icon: '✨', action: 'Criar nova Sintonia',        reward: '+20 🔮', note: 'Ilimitado'            },
          ].map((item, i) => (
            <View key={i} style={styles.sourceItem}>
              <Text style={styles.sourceIcon}>{item.icon}</Text>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceAction}>{item.action}</Text>
                <Text style={styles.sourceNote}>{item.note}</Text>
              </View>
              <Text style={styles.sourceReward}>{item.reward}</Text>
            </View>
          ))}
        </Card>

        {/* Regras */}
        <Card padding={S.lg} style={{ marginHorizontal: S.md, borderWidth: 1, borderColor: COLORS.border, gap: S.sm }}>
          <Text style={styles.rulesTitle}>⚠️ Regras do Cofre</Text>
          <Text style={styles.rulesText}>• Armazena apenas Fragmentos — nunca cristais</Text>
          <Text style={styles.rulesText}>• Capacidade máxima: 5.000 fragmentos (= 50 cristais)</Text>
          <Text style={styles.rulesText}>• Saque gratuito: disponível após 48h do 1º depósito</Text>
          <Text style={styles.rulesText}>• Galáxia Plus: saque imediato sempre</Text>
          <Text style={styles.rulesText}>• Cofre cheio para de acumular — resgate para continuar</Text>
          <Text style={styles.rulesText}>• Limite: 100 cristais/dia via Cofre</Text>
          <Text style={styles.rulesText}>• Missões e compras NÃO alimentam o Cofre</Text>
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero:            { margin: S.md, borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, borderWidth: 1, borderColor: COLORS.borderLight },
  heroIcon:        { fontSize: 72 },
  statusBadge:     { borderRadius: R.full, borderWidth: 1, paddingHorizontal: S.lg, paddingVertical: S.xs },
  statusLabel:     { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.extrabold, textTransform: 'uppercase', letterSpacing: 1 },
  vaultFragments:  { fontSize: 64, fontWeight: FONT_WEIGHT.extrabold, lineHeight: 70 },
  vaultFragmentsLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textTransform: 'uppercase', letterSpacing: 1 },
  progressSection: { width: '100%', gap: S.xs },
  progressHeader:  { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel:   { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  progressValue:   { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  progressBar:     { height: 12, backgroundColor: COLORS.border, borderRadius: R.full, overflow: 'hidden' },
  progressFill:    { height: '100%', borderRadius: R.full },
  equivalentRow:   { backgroundColor: COLORS.surface + '0D', borderRadius: R.lg, paddingHorizontal: S.lg, paddingVertical: S.sm },
  equivalentText:  { color: COLORS.surface, fontSize: FONT_SIZE.sm, textAlign: 'center' },
  hintText:        { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center', fontStyle: 'italic' },

  resultCard:      { marginHorizontal: S.md, marginBottom: S.md, backgroundColor: COLORS.secondary + '26', borderRadius: R.lg, padding: S.lg, alignItems: 'center', gap: S.xs, borderWidth: 1, borderColor: COLORS.secondary },
  resultIcon:      { fontSize: FONT_SIZE.display },
  resultText:      { color: COLORS.secondary, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extrabold },

  withdrawSection: { marginHorizontal: S.md, gap: S.md, marginBottom: S.lg },
  galaxiaBadge:    { backgroundColor: COLORS.secondary + '26', borderRadius: R.lg, padding: S.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.secondary },
  galaxiaBadgeText: { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  cooldownIcon:    { fontSize: FONT_SIZE.hero },
  cooldownText:    { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  cooldownSub:     { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  dailyInfo:       { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },
  errorText:       { color: COLORS.error, fontSize: FONT_SIZE.sm, textAlign: 'center' },

  sectionTitle:    { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginBottom: S.sm },
  sourceItem:      { flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sourceIcon:      { fontSize: 24, width: 32 },
  sourceInfo:      { flex: 1 },
  sourceAction:    { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  sourceNote:      { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  sourceReward:    { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  rulesTitle:      { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  rulesText:       { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
// ============================================
// LUMINA — VAULT SCREEN v6.0
// src/modules/engagement/screens/VaultScreen.tsx
//
// v6.0 — DOIS BOTÕES.
//   1. Sacar fragmentos: Cofre → carteira (48h; Galáxia Plus na hora)
//   2. Converter em cristais: carteira → cristais, a pessoa
//      escolhe quanto (FragmentConverter, o mesmo da tela de
//      Fragmentos). Sem teto, sem espera.
//
// Estado de erro com "Tentar de novo". A animação de pulsar é
// parada ao sair do estado pronto/cheio.
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { useNavigation }   from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAuth }         from '../../../context/AuthContext';
import { useCoins }        from '../../../context/CoinsContext';
import { useVault, VaultStatus } from '../hooks/useVault';
import { useFragments }    from '../hooks/useFragments';
import FragmentConverter   from '../components/FragmentConverter';
import Header from '../../../components/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

const SCREEN_TITLE = 'Cofre de Sintonia';

function formatTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} minutos`;
}

const STATUS_CONFIG: Record<VaultStatus, {
  icon:     string;
  label:    string;
  color:    string;
  gradient: [string, string];
  message:  string;
}> = {
  EMPTY:   { icon: '🗝️', label: 'Vazio',    color: COLORS.textMuted, gradient: ['#0D0D1A', '#1A0A2E'], message: 'Interaja com outros usuários para encher o Cofre.' },
  FILLING: { icon: '🔮', label: 'Enchendo', color: COLORS.secondary, gradient: ['#1A0A2E', '#2D1B4E'], message: 'O Cofre libera o saque 48h depois do primeiro depósito.' },
  READY:   { icon: '✨', label: 'Pronto!',  color: '#A8E063',        gradient: ['#0A2E0A', '#1B4E1B'], message: 'Seus fragmentos estão liberados para sacar.' },
  FULL:    { icon: '👑', label: 'Cheio!',   color: '#FFD700',        gradient: ['#2E1A00', '#4E3200'], message: 'Cofre cheio! Saque para continuar acumulando.' },
};

export default function VaultScreen() {
  const { user } = useAuth();
  const { refreshWallet } = useCoins();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const vault     = useVault(user?.uid);

  const fragments = useFragments(user?.uid);

  const [showConverter, setShowConverter] = useState(false);
  const [withdrawn,     setWithdrawn]     = useState<number | null>(null);
  const [converted,     setConverted]     = useState<number | null>(null);
  const [cooldownLeft,  setCooldownLeft]  = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const data   = vault.data;
  const status = data?.status ?? 'EMPTY';

  // Pulsação para cofre pronto/cheio — parada ao sair do estado.
  useEffect(() => {
    if (status !== 'READY' && status !== 'FULL') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => { loop.stop(); pulseAnim.setValue(1); };
  }, [status, pulseAnim]);

  // Countdown do ciclo
  useEffect(() => {
    if (!data?.cooldownRemainingMs) { setCooldownLeft(0); return; }
    setCooldownLeft(data.cooldownRemainingMs);
    const interval = setInterval(() => {
      setCooldownLeft(prev => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [data?.cooldownRemainingMs]);

  async function handleWithdraw() {
    setConverted(null);
    const result = await vault.withdraw();
    if (result) {
      setWithdrawn(result.fragmentsMoved);
      // Os fragmentos chegaram na carteira: o painel precisa ver.
      await fragments.refresh(true);
    }
  }

  async function handleConvert(crystals: number) {
    setWithdrawn(null);
    const result = await fragments.convert(crystals);
    if (result) {
      setConverted(result.crystalsGained);
      await refreshWallet();
      await vault.refresh(true);
    }
  }

  if (vault.loading) {
    return (
      <View style={styles.container}>
        <Header title={SCREEN_TITLE} showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <Header title={SCREEN_TITLE} showBack={true} showHome={true} />
        <View style={styles.center}>
          <Text style={styles.errorIcon}>🗝️</Text>
          <Text style={styles.errorTitle}>Não foi possível carregar o Cofre</Text>
          <Text style={styles.errorSub}>Verifique sua conexão e tente de novo.</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { vault.refresh(); fragments.refresh(); }}
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar de novo"
          >
            <Text style={styles.retryText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const cfg        = STATUS_CONFIG[status];
  const pct        = data.vaultPercent ?? 0;
  const walletFrag = fragments.status?.fragments ?? data.walletFragments ?? 0;
  const perCrystal = fragments.status?.fragmentsPerCrystal ?? fragments.status?.fragmentsNeeded ?? 100;

  return (
    <View style={styles.container}>
      <Header title={SCREEN_TITLE} showBack={true} showHome={true} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero Cofre */}
        <LinearGradient colors={cfg.gradient} style={styles.hero}>
          <Animated.Text style={[styles.heroIcon, { transform: [{ scale: pulseAnim }] }]}>
            {cfg.icon}
          </Animated.Text>

          <View style={[styles.statusBadge, { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}>
            <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>

          <Text style={[styles.vaultFragments, { color: cfg.color }]}>{data.vaultFragments}</Text>
          <Text style={styles.vaultFragmentsLabel}>fragmentos no Cofre</Text>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Capacidade</Text>
              <Text style={[styles.progressValue, { color: cfg.color }]}>
                {data.vaultFragments}/{data.vaultMax}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: cfg.color }]} />
            </View>
          </View>

          <Text style={styles.hintText}>{cfg.message}</Text>
        </LinearGradient>

        {/* Resultados */}
        {withdrawn !== null && (
          <View style={styles.resultCard}>
            <Text style={styles.resultIcon}>🔮</Text>
            <Text style={styles.resultText}>+{withdrawn} fragmentos na carteira</Text>
            <Text style={styles.resultSub}>Converta em cristais quando quiser.</Text>
          </View>
        )}
        {converted !== null && (
          <View style={styles.resultCard}>
            <Text style={styles.resultIcon}>✨</Text>
            <Text style={styles.resultText}>
              +{converted} {converted === 1 ? 'Cristal Gratuito' : 'Cristais Gratuitos'}!
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          {data.isGalaxiaPlus && (
            <View style={styles.galaxiaBadge}>
              <Text style={styles.galaxiaBadgeText}>💜 Galáxia Plus — Saque Imediato</Text>
            </View>
          )}

          {data.isLocked && cooldownLeft > 0 && (
            <View style={styles.cooldownCard}>
              <Text style={styles.cooldownIcon}>⏳</Text>
              <View style={styles.cooldownInfo}>
                <Text style={styles.cooldownText}>Saque disponível em {formatTime(cooldownLeft)}</Text>
                <Text style={styles.cooldownSub}>Você recebe um aviso quando liberar.</Text>
              </View>
            </View>
          )}

          {/* Botão 1 — Sacar fragmentos */}
          <TouchableOpacity
            style={[
              styles.withdrawBtn,
              (!data.canWithdraw || vault.withdrawing) && styles.btnDisabled,
              status === 'FULL' && styles.withdrawBtnFull,
            ]}
            onPress={handleWithdraw}
            disabled={!data.canWithdraw || vault.withdrawing}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Sacar ${data.vaultFragments} fragmentos para a carteira`}
          >
            {vault.withdrawing ? (
              <ActivityIndicator color={COLORS.surface} />
            ) : (
              <Text style={styles.withdrawBtnText}>
                {data.canWithdraw
                  ? `🔮 Sacar ${data.vaultFragments} fragmentos`
                  : data.vaultFragments <= 0
                    ? 'Cofre vazio'
                    : data.antiSpamActive
                      ? 'Aguarde alguns segundos'
                      : 'Aguardando desbloqueio'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Botão 2 — Converter em cristais */}
          <TouchableOpacity
            style={styles.convertToggle}
            onPress={() => setShowConverter(v => !v)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Converter fragmentos em cristais"
          >
            <Text style={styles.convertToggleText}>
              ✨ Converter em cristais {showConverter ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {showConverter && (
            <FragmentConverter
              fragments={walletFrag}
              fragmentsPerCrystal={perCrystal}
              converting={fragments.converting}
              onConvert={handleConvert}
            />
          )}

          {(vault.error || fragments.error) && (
            <Text style={styles.errorText}>{vault.error ?? fragments.error}</Text>
          )}
        </View>

        {/* Como encher o Cofre */}
        <Text style={styles.sectionTitle}>Como encher o Cofre</Text>
        <View style={styles.sourcesList}>
          {[
            { icon: '👁️', action: 'Receber visita no perfil', reward: '+2 🔮',     note: '1x por visitante/dia · até 20/dia' },
            { icon: '💜', action: 'Receber uma curtida',       reward: '+5 🔮',     note: '1x por usuário/dia'                },
            { icon: '✨', action: 'Criar nova Sintonia',       reward: '+20 🔮',    note: 'a cada sintonia nova'              },
            { icon: '🎁', action: 'Marcos de nível',           reward: '10–300 🔮', note: 'níveis 10, 20, 30, 40 e 50'        },
          ].map(item => (
            <View key={item.action} style={styles.sourceItem}>
              <Text style={styles.sourceIcon}>{item.icon}</Text>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceAction}>{item.action}</Text>
                <Text style={styles.sourceNote}>{item.note}</Text>
              </View>
              <Text style={styles.sourceReward}>{item.reward}</Text>
            </View>
          ))}
        </View>

        {/* Sinergia real: visita recebida deposita +2 no Cofre. */}
        <TouchableOpacity
          style={styles.boostCta}
          onPress={() => navigation.navigate('Boosts')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Ver impulsos para receber mais visitas"
        >
          <Text style={styles.boostCtaTitle}>🚀 Encha o Cofre mais rápido</Text>
          <Text style={styles.boostCtaSub}>
            Cada visita deposita +2 🔮. Impulsos colocam seu perfil no topo e trazem mais visitas.
          </Text>
        </TouchableOpacity>

        {/* Regras */}
        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>⚠️ Regras do Cofre</Text>
          <Text style={styles.rulesText}>• O saque leva os fragmentos do Cofre para a sua carteira</Text>
          <Text style={styles.rulesText}>• Saque disponível 48h após o 1º depósito — e continua liberado até você sacar</Text>
          <Text style={styles.rulesText}>• Galáxia Plus: saque imediato sempre</Text>
          <Text style={styles.rulesText}>• Você recebe um aviso quando o Cofre liberar</Text>
          <Text style={styles.rulesText}>• Capacidade: 5.000 fragmentos — saque para continuar acumulando</Text>
          <Text style={styles.rulesText}>• Conversão: {perCrystal} 🔮 = 1 ✨, na quantidade que você quiser</Text>
          <Text style={styles.rulesText}>• Fragmentos não expiram</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl, gap: S.sm },
  errorIcon:       { fontSize: 44 },
  errorTitle:      { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  errorSub:        { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center' },
  retryBtn:        { marginTop: S.md, borderWidth: 1, borderColor: COLORS.secondary, borderRadius: R.full, paddingHorizontal: S.xl, paddingVertical: S.sm },
  retryText:       { color: COLORS.secondary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },

  hero:            { margin: S.md, borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)' },
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
  hintText:        { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center', fontStyle: 'italic' },

  resultCard:      { marginHorizontal: S.md, marginBottom: S.md, backgroundColor: 'rgba(181,123,238,0.15)', borderRadius: R.lg, padding: S.lg, alignItems: 'center', gap: S.xs, borderWidth: 1, borderColor: COLORS.secondary },
  resultIcon:      { fontSize: 36 },
  resultText:      { color: COLORS.secondary, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extrabold, textAlign: 'center' },
  resultSub:       { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },

  actions:         { marginHorizontal: S.md, gap: S.md, marginBottom: S.lg },
  galaxiaBadge:    { backgroundColor: 'rgba(181,123,238,0.15)', borderRadius: R.lg, padding: S.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.secondary },
  galaxiaBadgeText: { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  cooldownCard:    { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: COLORS.border },
  cooldownIcon:    { fontSize: 28 },
  cooldownInfo:    { flex: 1 },
  cooldownText:    { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  cooldownSub:     { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  withdrawBtn:     { backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center', justifyContent: 'center' },
  withdrawBtnFull: { backgroundColor: '#B8860B' },
  btnDisabled:     { opacity: 0.4 },
  withdrawBtnText: { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  convertToggle:   { borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.secondary, backgroundColor: COLORS.secondary + '15' },
  convertToggleText: { color: COLORS.secondary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  errorText:       { color: '#FF6B6B', fontSize: FONT_SIZE.sm, textAlign: 'center' },

  sectionTitle:    { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginBottom: S.sm },
  sourcesList:     { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: S.lg },
  sourceItem:      { flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sourceIcon:      { fontSize: 24, width: 32 },
  sourceInfo:      { flex: 1 },
  sourceAction:    { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  sourceNote:      { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  sourceReward:    { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },

  boostCta:        { marginHorizontal: S.md, marginBottom: S.lg, borderRadius: R.lg, padding: S.md, gap: 4, borderWidth: 1, borderColor: '#B57BEE66', backgroundColor: '#B57BEE12' },
  boostCtaTitle:   { color: '#C9A4F2', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  boostCtaSub:     { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, lineHeight: 18 },
  rulesCard:       { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.lg, gap: S.sm, borderWidth: 1, borderColor: COLORS.border },
  rulesTitle:      { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  rulesText:       { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
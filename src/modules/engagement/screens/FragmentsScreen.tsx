// ============================================
// LUMINA — FRAGMENTS SCREEN v5.2
// src/modules/engagement/screens/FragmentsScreen.tsx
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
import { useFragments }    from '../hooks/useFragments';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { Button, Card } from '../../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, GRADIENTS } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function formatCooldown(ms: number): string {
  const hours   = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes} minutos`;
}

export default function FragmentsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { refreshWallet } = useCoins();
  const { status, loading, converting, error, convert, refresh } = useFragments(user?.uid);

  const [converted,    setConverted]    = useState<{ crystals: number; fragments: number } | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!status?.cooldownRemainingMs) return;
    setCooldownLeft(status.cooldownRemainingMs);
    const interval = setInterval(() => {
      setCooldownLeft(prev => {
        const next = prev - 1000;
        if (next <= 0) { clearInterval(interval); return 0; }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status?.cooldownRemainingMs]);

  async function handleConvert() {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true, speed: 30 }),
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 20 }),
    ]).start();

    const result = await convert();
    if (result) {
      setConverted({ crystals: result.crystalsGained, fragments: result.fragmentsUsed });
      await refreshWallet();
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Fragmentos" showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  const fragments         = status?.fragments         ?? 0;
  const coinsGratuitos    = status?.coinsGratuitos    ?? 0;
  const canConvert        = status?.canConvert        ?? false;
  const crystalsAvailable = status?.crystalsAvailable ?? 0;
  const fragmentsNeeded   = status?.fragmentsNeeded   ?? 100;
  const cooldownActive    = status?.cooldownActive    ?? false;
  const progress          = Math.min(fragments / fragmentsNeeded, 1);

  return (
    <View style={styles.container}>
      <Header title="Fragmentos de Sintonia" showBack={true} showHome={true} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <LinearGradient colors={[GRADIENTS.faisca[0], GRADIENTS.faisca[1]]} style={styles.hero}>
          <Text style={styles.heroIcon}>🔮</Text>
          <Text style={styles.heroFragments}>{fragments}</Text>
          <Text style={styles.heroLabel}>Fragmentos de Sintonia</Text>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Próximo cristal</Text>
              <Text style={styles.progressValue}>{fragments}/{fragmentsNeeded}</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
            </View>
            {fragments >= fragmentsNeeded && (
              <Text style={styles.progressReady}>✨ Pronto para converter!</Text>
            )}
          </View>

          <View style={styles.balanceRow}>
            <View style={styles.balancePill}>
              <Text style={styles.balanceIcon}>✨</Text>
              <Text style={styles.balanceValue}>{coinsGratuitos}</Text>
              <Text style={styles.balanceLabel}>Cristais Gratuitos</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Resultado */}
        {converted && (
          <View style={styles.convertedCard}>
            <Text style={styles.convertedIcon}>✨</Text>
            <Text style={styles.convertedText}>
              +{converted.crystals} Cristal{converted.crystals > 1 ? 'is' : ''} Gratuito{converted.crystals > 1 ? 's' : ''}!
            </Text>
            <Text style={styles.convertedSub}>
              {converted.fragments} fragmentos convertidos
            </Text>
          </View>
        )}

        {/* Conversão */}
        <View style={styles.convertSection}>
          <Text style={styles.convertTitle}>Converter Fragmentos</Text>
          <Text style={styles.convertFormula}>
            {fragmentsNeeded} 🔮 = 1 ✨ Cristal Gratuito
          </Text>

          {crystalsAvailable > 0 && (
            <Text style={styles.convertAvailable}>
              Você pode converter {crystalsAvailable} cristal{crystalsAvailable > 1 ? 'is' : ''} agora
            </Text>
          )}

          {cooldownActive && cooldownLeft > 0 && !converted && (
            <Card padding={S.md} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={styles.cooldownIcon}>⏳</Text>
              <Text style={styles.cooldownText}>
                Próxima conversão em {formatCooldown(cooldownLeft)}
              </Text>
            </Card>
          )}

          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Button
              icon={<Text style={{ fontSize: FONT_SIZE.lg }}>🔮</Text>}
              label={canConvert
                ? `Converter ${crystalsAvailable * fragmentsNeeded} fragmentos`
                : fragments < fragmentsNeeded
                  ? `Faltam ${fragmentsNeeded - fragments} fragmentos`
                  : 'Aguarde o cooldown'}
              onPress={handleConvert}
              loading={converting}
              disabled={!canConvert || converting}
              variant="primary"
              fullWidth
            />
          </Animated.View>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {/* Como ganhar */}
        <Text style={styles.sectionTitle}>Como ganhar Fragmentos</Text>
        <Card padding={0} style={{ marginHorizontal: S.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: S.lg }}>
          {[
            { icon: '📋', text: 'Completar missões diárias',  value: '10–15 🔮' },
            { icon: '👁️', text: 'Receber visitas no perfil',   value: '+1 🔮'    },
            { icon: '💜', text: 'Receber curtidas',            value: '+1 🔮'    },
            { icon: '✨', text: 'Criar uma nova Sintonia',     value: '+3 🔮'    },
          ].map((item, i) => (
            <View key={i} style={styles.infoItem}>
              <Text style={styles.infoItemIcon}>{item.icon}</Text>
              <Text style={styles.infoItemText}>{item.text}</Text>
              <Text style={styles.infoItemValue}>{item.value}</Text>
            </View>
          ))}
        </Card>

        {/* Regras */}
        <Card padding={S.lg} style={{ marginHorizontal: S.md, borderWidth: 1, borderColor: COLORS.border, gap: S.sm }}>
          <Text style={styles.rulesTitle}>⚠️ Regras importantes</Text>
          <Text style={styles.rulesText}>• Cooldown de 24h entre conversões</Text>
          <Text style={styles.rulesText}>• Máximo de 5 cristais por conversão</Text>
          <Text style={styles.rulesText}>• Fragmentos expiram 10% a cada 7 dias sem converter</Text>
          <Text style={styles.rulesText}>• Fragmentos não são compráveis — apenas ganháveis</Text>
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: COLORS.background },
  center:            { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero:              { margin: S.md, borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, borderWidth: 1, borderColor: COLORS.borderLight },
  heroIcon:          { fontSize: 56 },
  heroFragments:     { color: COLORS.secondary, fontSize: 64, fontWeight: FONT_WEIGHT.extrabold, lineHeight: 70 },
  heroLabel:         { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textTransform: 'uppercase', letterSpacing: 1 },
  progressSection:   { width: '100%', gap: S.xs },
  progressHeader:    { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel:     { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  progressValue:     { color: COLORS.secondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  progressBar:       { height: 10, backgroundColor: COLORS.border, borderRadius: R.full, overflow: 'hidden' },
  progressFill:      { height: '100%', backgroundColor: COLORS.secondary, borderRadius: R.full },
  progressReady:     { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  balanceRow:        { flexDirection: 'row', justifyContent: 'center' },
  balancePill:       { flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: COLORS.premium + '1A', borderRadius: R.full, paddingHorizontal: S.lg, paddingVertical: S.sm, borderWidth: 1, borderColor: COLORS.premium + '4D' },
  balanceIcon:       { fontSize: FONT_SIZE.subtitle },
  balanceValue:      { color: COLORS.premium, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extrabold },
  balanceLabel:      { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  convertedCard:     { marginHorizontal: S.md, marginBottom: S.md, backgroundColor: COLORS.secondary + '26', borderRadius: R.lg, padding: S.lg, alignItems: 'center', gap: S.xs, borderWidth: 1, borderColor: COLORS.secondary },
  convertedIcon:     { fontSize: FONT_SIZE.display },
  convertedText:     { color: COLORS.secondary, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extrabold },
  convertedSub:      { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  convertSection:    { marginHorizontal: S.md, gap: S.md, marginBottom: S.lg },
  convertTitle:      { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  convertFormula:    { color: COLORS.textMuted, fontSize: FONT_SIZE.md, textAlign: 'center' },
  convertAvailable:  { color: COLORS.secondary, fontSize: FONT_SIZE.sm, textAlign: 'center', fontWeight: FONT_WEIGHT.semibold },
  cooldownIcon:      { fontSize: 24 },
  cooldownText:      { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  errorText:         { color: COLORS.error, fontSize: FONT_SIZE.sm, textAlign: 'center' },
  sectionTitle:      { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginBottom: S.sm },
  infoItem:          { flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoItemIcon:      { fontSize: FONT_SIZE.xxl, width: 32 },
  infoItemText:      { flex: 1, color: COLORS.surface, fontSize: FONT_SIZE.sm },
  infoItemValue:     { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  rulesTitle:        { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  rulesText:         { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
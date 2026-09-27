// ============================================
// LUMINA — FRAGMENTS SCREEN v6.0
// src/modules/engagement/screens/FragmentsScreen.tsx
//
// v6.0 — mesmo painel de conversão do Cofre (FragmentConverter):
// a pessoa escolhe quanto converte. Sem teto, sem espera, sem
// expiração.
//
// "Como ganhar" corrigido: visitas, curtidas e sintonias vão para
// o COFRE (+2/+5/+20), não para a carteira (a tela dizia +1/+1/+3).
// ============================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { useNavigation }   from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }         from '../../../context/AuthContext';
import { useCoins }        from '../../../context/CoinsContext';
import { useFragments }    from '../hooks/useFragments';
import FragmentConverter   from '../components/FragmentConverter';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const SCREEN_TITLE = 'Fragmentos de Sintonia';

export default function FragmentsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { refreshWallet } = useCoins();
  const { status, loading, converting, error, convert, refresh } = useFragments(user?.uid);

  const [converted, setConverted] = useState<{ crystals: number; fragments: number } | null>(null);

  async function handleConvert(crystals: number) {
    const result = await convert(crystals);
    if (result) {
      setConverted({ crystals: result.crystalsGained, fragments: result.fragmentsUsed });
      await refreshWallet();
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title={SCREEN_TITLE} showBack={true} showHome={true} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.secondary} size="large" />
        </View>
      </View>
    );
  }

  if (!status) {
    return (
      <View style={styles.container}>
        <Header title={SCREEN_TITLE} showBack={true} showHome={true} />
        <View style={styles.center}>
          <Text style={styles.errorIcon}>🔮</Text>
          <Text style={styles.errorTitle}>Não foi possível carregar</Text>
          <Text style={styles.errorSub}>Verifique sua conexão e tente de novo.</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => refresh()}
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar de novo"
          >
            <Text style={styles.retryText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const fragments  = status.fragments ?? 0;
  const perCrystal = status.fragmentsPerCrystal ?? status.fragmentsNeeded ?? 100;

  return (
    <View style={styles.container}>
      <Header title={SCREEN_TITLE} showBack={true} showHome={true} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <LinearGradient colors={['#1A0A2E', '#2D1B4E']} style={styles.hero}>
          <Text style={styles.heroIcon}>🔮</Text>
          <Text style={styles.heroFragments}>{fragments}</Text>
          <Text style={styles.heroLabel}>Fragmentos na carteira</Text>

          <View style={styles.balancePill}>
            <Text style={styles.balanceIcon}>✨</Text>
            <Text style={styles.balanceValue}>{status.coinsGratuitos ?? 0}</Text>
            <Text style={styles.balanceLabel}>Cristais Gratuitos</Text>
          </View>
        </LinearGradient>

        {converted && (
          <View style={styles.convertedCard}>
            <Text style={styles.convertedIcon}>✨</Text>
            <Text style={styles.convertedText}>
              +{converted.crystals} {converted.crystals === 1 ? 'Cristal Gratuito' : 'Cristais Gratuitos'}!
            </Text>
            <Text style={styles.convertedSub}>{converted.fragments} fragmentos convertidos</Text>
          </View>
        )}

        <View style={styles.converterWrap}>
          <FragmentConverter
            fragments={fragments}
            fragmentsPerCrystal={perCrystal}
            converting={converting}
            onConvert={handleConvert}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={styles.vaultLink}
            onPress={() => navigation.navigate('Vault')}
            accessibilityRole="button"
            accessibilityLabel="Abrir o Cofre de Sintonia"
          >
            <Text style={styles.vaultLinkText}>🗝️ Tem fragmentos no Cofre? Sacar ›</Text>
          </TouchableOpacity>
        </View>

        {/* Como ganhar */}
        <Text style={styles.sectionTitle}>Como ganhar Fragmentos</Text>
        <View style={styles.infoList}>
          {[
            { icon: '📋', text: 'Missões diárias',                      value: '8–15 🔮'   },
            { icon: '🗝️', text: 'Cofre: visitas, curtidas e sintonias', value: '+2 a +20 🔮' },
            { icon: '🎁', text: 'Marcos de nível (10 a 50)',            value: '10–300 🔮' },
            { icon: '🏆', text: 'Conquistas e coleções',                value: 'variável'  },
          ].map(item => (
            <View key={item.text} style={styles.infoItem}>
              <Text style={styles.infoItemIcon}>{item.icon}</Text>
              <Text style={styles.infoItemText}>{item.text}</Text>
              <Text style={styles.infoItemValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Regras */}
        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>ℹ️ Regras</Text>
          <Text style={styles.rulesText}>• {perCrystal} fragmentos = 1 cristal gratuito</Text>
          <Text style={styles.rulesText}>• Converta a quantidade que quiser, quando quiser</Text>
          <Text style={styles.rulesText}>• Fragmentos não expiram</Text>
          <Text style={styles.rulesText}>• Fragmentos não são compráveis — apenas ganháveis</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl, gap: S.sm },
  errorIcon:      { fontSize: 44 },
  errorTitle:     { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  errorSub:       { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center' },
  retryBtn:       { marginTop: S.md, borderWidth: 1, borderColor: COLORS.secondary, borderRadius: R.full, paddingHorizontal: S.xl, paddingVertical: S.sm },
  retryText:      { color: COLORS.secondary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  hero:           { margin: S.md, borderRadius: R.xl, padding: S.xl, alignItems: 'center', gap: S.md, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)' },
  heroIcon:       { fontSize: 56 },
  heroFragments:  { color: COLORS.secondary, fontSize: 64, fontWeight: FONT_WEIGHT.extrabold, lineHeight: 70 },
  heroLabel:      { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textTransform: 'uppercase', letterSpacing: 1 },
  balancePill:    { flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: R.full, paddingHorizontal: S.lg, paddingVertical: S.sm, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  balanceIcon:    { fontSize: 16 },
  balanceValue:   { color: '#FFD700', fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extrabold },
  balanceLabel:   { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  convertedCard:  { marginHorizontal: S.md, marginBottom: S.md, backgroundColor: 'rgba(181,123,238,0.15)', borderRadius: R.lg, padding: S.lg, alignItems: 'center', gap: S.xs, borderWidth: 1, borderColor: COLORS.secondary },
  convertedIcon:  { fontSize: 36 },
  convertedText:  { color: COLORS.secondary, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extrabold },
  convertedSub:   { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  converterWrap:  { marginHorizontal: S.md, gap: S.md, marginBottom: S.lg },
  errorText:      { color: '#FF6B6B', fontSize: FONT_SIZE.sm, textAlign: 'center' },
  vaultLink:      { alignSelf: 'center', paddingVertical: S.xs },
  vaultLinkText:  { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  sectionTitle:   { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginBottom: S.sm },
  infoList:       { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: S.lg },
  infoItem:       { flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoItemIcon:   { fontSize: 22, width: 32 },
  infoItemText:   { flex: 1, color: COLORS.surface, fontSize: FONT_SIZE.sm },
  infoItemValue:  { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  rulesCard:      { marginHorizontal: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.lg, gap: S.sm, borderWidth: 1, borderColor: COLORS.border },
  rulesTitle:     { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  rulesText:      { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
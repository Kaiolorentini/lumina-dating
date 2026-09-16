// ============================================
// LUMINA — CRYSTAL PACKS SCREEN v1.0
// src/modules/economy/screens/CrystalPacksScreen.tsx
//
// FASE 7 — recorte do StoreScreen: pacotes de cristais e
// Galáxia Plus, com o fluxo de CPF preservado na íntegra.
//
// O CPF é exigido pelo Banco Central para cobrança Pix, mas não
// é armazenado — trafega app → CF → Asaas e é descartado.
// LGPD, minimização (Art. 6º, III).
// ============================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient }   from 'expo-linear-gradient';
import { useNavigation }    from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }          from '../../../context/AuthContext';
import { useCoins }         from '../../../context/CoinsContext';
import {
  COIN_PACKAGES_DISPLAY,
  initiatePurchase,
  CoinPackageDisplay,
} from '../services/purchaseService';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import CpfPromptModal from '../../../components/CpfPromptModal';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const PACK_ICONS: Record<string, string> = {
  starter: '✨', popular: '💎', supremo: '👑', galaxia: '🌌',
};

const GALAXIA_PLUS_BENEFITS = [
  '💜 10 Cartas do Destino por dia',
  '✨ 300 Cristais Gratuitos todo mês',
  '⚡ Faísca com bônus +20%',
  '🔓 Revelações mais baratas',
  '🏅 Badge exclusivo Galáxia',
  '📊 Ver quem visitou seu perfil',
];

function PackageCard({
  pkg, onPress, loading,
}: {
  pkg: CoinPackageDisplay; onPress: () => void; loading: boolean;
}) {
  const isPopular = pkg.highlighted;

  return (
    <TouchableOpacity
      style={[styles.packageCard, isPopular && styles.packageCardHighlighted]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {isPopular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>⭐ MAIS POPULAR</Text>
        </View>
      )}
      <View style={styles.packageContent}>
        <Text style={styles.packageIcon}>{PACK_ICONS[pkg.id] ?? '💎'}</Text>
        <View style={styles.packageInfo}>
          <Text style={[styles.packageLabel, isPopular && styles.packageLabelHighlighted]}>
            {pkg.label}
          </Text>
          <Text style={styles.packageCoins}>
            {pkg.coinsPremium.toLocaleString()} Cristais Premium
          </Text>
          {pkg.bonus > 0 && <Text style={styles.packageBonus}>+{pkg.bonus} bônus</Text>}
          {pkg.isFirstPurchasePkg && (
            <Text style={styles.packageFirst}>🎁 Dobro na 1ª compra!</Text>
          )}
        </View>
        <View style={styles.packagePriceBox}>
          {loading
            ? <ActivityIndicator color={COLORS.secondary} />
            : <Text style={[styles.packagePrice, isPopular && styles.packagePriceHighlighted]}>
                {pkg.priceLabel}
              </Text>
          }
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CrystalPacksScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { wallet } = useCoins();

  const coinsPremium = wallet?.coinsPremium ?? 0;

  const [loadingPkg,     setLoadingPkg]     = useState<string | null>(null);
  const [loadingGalaxia, setLoadingGalaxia] = useState(false);

  // packageId aguardando CPF. Guardar o id (e não um booleano)
  // permite um único modal servir pacotes e Galáxia Plus.
  const [pendingPackageId, setPendingPackageId] = useState<string | null>(null);

  function handlePurchase(pkg: CoinPackageDisplay) {
    if (!user?.uid) return;
    setPendingPackageId(pkg.id);
  }

  function handleGalaxiaPlus() {
    if (!user?.uid) return;
    setPendingPackageId('galaxia_plus');
  }

  async function handleCpfConfirm(cpfDigits: string) {
    const packageId = pendingPackageId;
    if (!user?.uid || !packageId) return;

    const isGalaxia = packageId === 'galaxia_plus';
    if (isGalaxia) setLoadingGalaxia(true);
    else           setLoadingPkg(packageId);

    try {
      const result = await initiatePurchase(packageId, cpfDigits);
      if (result.success) {
        setPendingPackageId(null);
        navigation.navigate('Checkout', {
          saleId:       result.saleId       ?? '',
          checkoutUrl:  result.checkoutUrl  ?? '',
          pixQrCode:    result.pixQrCode    ?? '',
          pixCopyPaste: result.pixCopyPaste ?? '',
        });
      } else {
        // Modal segue aberto: a falha mais provável é CPF recusado
        // pelo Asaas, e fechar obrigaria a redigitar tudo.
        Alert.alert(
          'Erro',
          result.error ?? (isGalaxia ? 'Erro ao iniciar assinatura.' : 'Erro ao iniciar pagamento.'),
        );
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível iniciar o pagamento.');
    } finally {
      setLoadingPkg(null);
      setLoadingGalaxia(false);
    }
  }

  return (
    <View style={styles.container}>
      <Header title="Cristais" showBack={true} showHome={true} />
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.balanceStrip}>
          <Text style={styles.balanceStripText}>
            Você tem <Text style={styles.balanceStripValue}>💎 {coinsPremium}</Text> Cristais Premium
          </Text>
        </View>

        <Text style={styles.sectionTitle}>💎 Pacotes</Text>
        <Text style={styles.sectionSub}>
          Cristais Premium desbloqueiam molduras, badges e impulsos exclusivos
        </Text>
        <View style={styles.packagesSection}>
          {COIN_PACKAGES_DISPLAY.map(pkg => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              loading={loadingPkg === pkg.id}
              onPress={() => handlePurchase(pkg)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>💜 Galáxia Plus</Text>
        <Text style={styles.sectionSub}>Assinatura mensal com benefícios contínuos</Text>
        <TouchableOpacity
          style={styles.galaxiaCard}
          onPress={handleGalaxiaPlus}
          disabled={loadingGalaxia}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#2A0A4E', '#4E1B7E']} style={styles.galaxiaInner}>
            <View style={styles.galaxiaHeader}>
              <Text style={styles.galaxiaIcon}>💜</Text>
              <View style={styles.galaxiaInfo}>
                <Text style={styles.galaxiaTitle}>Galáxia Plus</Text>
                <Text style={styles.galaxiaPrice}>R$ 19,90/mês</Text>
              </View>
              {loadingGalaxia
                ? <ActivityIndicator color={COLORS.secondary} />
                : <Text style={styles.galaxiaArrow}>›</Text>
              }
            </View>
            <View style={styles.galaxiaBenefits}>
              {GALAXIA_PLUS_BENEFITS.map((b, i) => (
                <Text key={i} style={styles.galaxiaBenefit}>{b}</Text>
              ))}
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ Pagamento</Text>
          <Text style={styles.infoText}>• 100% seguro via PIX</Text>
          <Text style={styles.infoText}>• CPF exigido pelo Banco Central, nunca armazenado</Text>
          <Text style={styles.infoText}>• Cristais não expiram após a compra</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <CpfPromptModal
        visible={pendingPackageId !== null}
        loading={loadingGalaxia || loadingPkg !== null}
        onConfirm={handleCpfConfirm}
        onCancel={() => setPendingPackageId(null)}
      />
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: COLORS.background },
  balanceStrip:           { marginHorizontal: S.md, marginTop: S.md, backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: R.full, paddingVertical: S.sm, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  balanceStripText:       { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  balanceStripValue:      { color: '#FFD700', fontWeight: FONT_WEIGHT.extrabold },
  sectionTitle:           { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginTop: S.lg, marginBottom: S.xs },
  sectionSub:             { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginHorizontal: S.md, marginBottom: S.sm },
  packagesSection:        { marginHorizontal: S.md, gap: S.sm },
  packageCard:            { backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: COLORS.border },
  packageCardHighlighted: { borderColor: COLORS.secondary, backgroundColor: 'rgba(181,123,238,0.08)' },
  popularBadge:           { backgroundColor: COLORS.secondary, borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: S.sm },
  popularBadgeText:       { color: COLORS.background, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extrabold, letterSpacing: 1 },
  packageContent:         { flexDirection: 'row', alignItems: 'center', gap: S.md },
  packageIcon:            { fontSize: 32 },
  packageInfo:            { flex: 1, gap: 2 },
  packageLabel:           { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  packageLabelHighlighted:{ color: COLORS.secondary },
  packageCoins:           { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  packageBonus:           { color: '#44FF88', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  packageFirst:           { color: '#FFD700', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  packagePriceBox:        { alignItems: 'flex-end' },
  packagePrice:           { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extrabold },
  packagePriceHighlighted:{ color: COLORS.secondary },
  galaxiaCard:            { marginHorizontal: S.md, borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.secondary + '66' },
  galaxiaInner:           { padding: S.lg, gap: S.md },
  galaxiaHeader:          { flexDirection: 'row', alignItems: 'center', gap: S.md },
  galaxiaIcon:            { fontSize: 36 },
  galaxiaInfo:            { flex: 1 },
  galaxiaTitle:           { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extrabold },
  galaxiaPrice:           { color: COLORS.secondary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  galaxiaArrow:           { color: COLORS.secondary, fontSize: 28, fontWeight: FONT_WEIGHT.bold },
  galaxiaBenefits:        { gap: S.xs },
  galaxiaBenefit:         { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, lineHeight: 20 },
  infoCard:               { marginHorizontal: S.md, marginTop: S.lg, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.lg, gap: S.xs, borderWidth: 1, borderColor: COLORS.border },
  infoTitle:              { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  infoText:               { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, lineHeight: 18 },
});
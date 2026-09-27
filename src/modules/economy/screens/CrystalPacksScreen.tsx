// ============================================
// LUMINA — CRYSTAL PACKS SCREEN v1.1
// src/modules/economy/screens/CrystalPacksScreen.tsx
//
// v1.1 — GALÁXIA PLUS PELO SERVIDOR.
//
// O card que INICIA a cobrança anunciava "R$ 19,90/mês",
// "Assinatura mensal", 10 cartas por dia e 300 cristais
// gratuitos todo mês. O Pix cobra R$ 24,99 ÚNICO, sem
// renovação, com 4 cartas e 300 premium na ativação. Oferta
// anunciada vincula (CDC art. 30).
//
// Agora preço, duração e benefícios vêm da
// getGalaxiaPlusStatus. SEM PREÇO CONFIRMADO, O TOQUE NÃO
// COBRA: abre a GalaxiaPlusScreen. O modal de CPF só aparece
// quando o valor na tela veio do servidor.
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
import { CrystalFieldBackground } from '../../../components/CrystalFieldBackground';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';
import { formatPrice, galaxiaPlusBenefitLines } from '../../premium/services/galaxiaPlusService';
import { useGalaxiaPlusStatus } from '../../premium/hooks/useGalaxiaPlusStatus';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const PACK_ICONS: Record<string, string> = {
  starter: '✨', popular: '💎', supremo: '👑', galaxia: '🌌',
};

function PackageCard({
  pkg, onPress, loading, firstPurchaseAvailable,
}: {
  pkg: CoinPackageDisplay; onPress: () => void; loading: boolean;
  /** true só quando a carteira carregou e o bônus nunca foi usado. */
  firstPurchaseAvailable: boolean;
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
          {pkg.isFirstPurchasePkg && firstPurchaseAvailable && (
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
  const galaxia    = useGalaxiaPlusStatus();

  const coinsPremium = wallet?.coinsPremium ?? 0;

  // A tela só promete o dobro quando TEM CERTEZA: carteira
  // carregada e bônus nunca usado. Antes o selo aparecia para
  // todo mundo, inclusive para quem o servidor não ia dobrar.
  const firstPurchaseAvailable = wallet !== null && wallet.firstPurchaseUsed !== true;
  const galaxiaPrice = formatPrice(galaxia?.price);

  const [loadingPkg,     setLoadingPkg]     = useState<string | null>(null);
  const [loadingGalaxia, setLoadingGalaxia] = useState(false);

  // packageId aguardando CPF. Guardar o id (e não um booleano)
  // permite um único modal servir pacotes e Galáxia Plus.
  const [pendingPackageId, setPendingPackageId] = useState<string | null>(null);

  const galaxiaLine = galaxia?.active
    ? `Ativa · ${galaxia.daysLeft} ${galaxia.daysLeft === 1 ? 'dia' : 'dias'} · renovar soma +${galaxia.duration}`
    : galaxia && galaxiaPrice
      ? `R$ ${galaxiaPrice} · ${galaxia.duration} dias`
      : 'Ver detalhes';

  function handlePurchase(pkg: CoinPackageDisplay) {
    if (!user?.uid) return;
    setPendingPackageId(pkg.id);
  }

  function handleGalaxiaPlus() {
    if (!user?.uid) return;
    // Sem o preço confirmado pelo servidor, ninguém inicia uma
    // cobrança: a pessoa vai para a tela que explica tudo.
    if (!galaxia || !galaxiaPrice) {
      navigation.navigate('GalaxiaPlus');
      return;
    }
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
          result.error ?? (isGalaxia ? 'Erro ao iniciar a Galáxia Plus.' : 'Erro ao iniciar pagamento.'),
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
      {/* Cristais dourados flutuando ao fundo — o universo do
          Lumina, e uma prévia do que está à venda. A deriva é
          lenta de propósito: a tela é de DECISÃO entre quatro
          pacotes, e um fundo agitado competiria com isso. */}
      <CrystalFieldBackground />

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
              firstPurchaseAvailable={firstPurchaseAvailable}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>💜 Galáxia Plus</Text>
        <Text style={styles.sectionSub}>
          {galaxia
            ? `${galaxia.duration} dias de benefícios · pagamento único, sem renovação automática`
            : 'Benefícios contínuos por tempo determinado'}
        </Text>
        <TouchableOpacity
          style={styles.galaxiaCard}
          onPress={handleGalaxiaPlus}
          disabled={loadingGalaxia}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Galáxia Plus. ${galaxiaLine}`}
        >
          <LinearGradient colors={['#2A0A4E', '#4E1B7E']} style={styles.galaxiaInner}>
            <View style={styles.galaxiaHeader}>
              <Text style={styles.galaxiaIcon}>💜</Text>
              <View style={styles.galaxiaInfo}>
                <Text style={styles.galaxiaTitle}>Galáxia Plus</Text>
                <Text style={styles.galaxiaPrice}>{galaxiaLine}</Text>
              </View>
              {loadingGalaxia
                ? <ActivityIndicator color={COLORS.secondary} />
                : <Text style={styles.galaxiaArrow}>›</Text>
              }
            </View>
            {galaxia && (
              <View style={styles.galaxiaBenefits}>
                {galaxiaPlusBenefitLines(galaxia).map(line => (
                  <Text key={line} style={styles.galaxiaBenefit}>{line}</Text>
                ))}
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.galaxiaDetailsLink}
          onPress={() => navigation.navigate('GalaxiaPlus')}
          accessibilityRole="button"
          accessibilityLabel="Como funciona a Galáxia Plus"
        >
          <Text style={styles.galaxiaDetailsText}>Como funciona ›</Text>
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
  // O fundo fica por baixo de tudo; o container não pode ter
  // cor própria ou taparia os cristais.
  container:              { flex: 1, backgroundColor: 'transparent' },
  balanceStrip:           { marginHorizontal: S.md, marginTop: S.md, backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: R.full, paddingVertical: S.sm, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  balanceStripText:       { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  balanceStripValue:      { color: '#FFD700', fontWeight: FONT_WEIGHT.extrabold },
  sectionTitle:           { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginTop: S.lg, marginBottom: S.xs },
  sectionSub:             { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginHorizontal: S.md, marginBottom: S.sm },
  packagesSection:        { marginHorizontal: S.md, gap: S.sm },
  // Opacidade quase total: com o card translúcido, os cristais
  // do fundo apareciam através do texto do preço.
  packageCard:            { backgroundColor: COLORS.card + 'F2', borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: COLORS.border },
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
  galaxiaDetailsLink:     { alignSelf: 'center', paddingVertical: S.sm, paddingHorizontal: S.md, marginTop: S.xs },
  galaxiaDetailsText:     { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  infoCard:               { marginHorizontal: S.md, marginTop: S.lg, backgroundColor: COLORS.card + 'F2', borderRadius: R.lg, padding: S.lg, gap: S.xs, borderWidth: 1, borderColor: COLORS.border },
  infoTitle:              { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  infoText:               { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, lineHeight: 18 },
});
// ============================================
// LUMINA — STORE SCREEN v5.4
// src/modules/economy/screens/StoreScreen.tsx
//
// v5.4: CPF pedido no momento da compra (CpfPromptModal).
// O CPF é exigido pelo Banco Central para cobrança Pix, mas
// não é armazenado — trafega app → CF → Asaas e é descartado.
// LGPD, minimização (Art. 6º, III).
//
// v5.3: navega para CheckoutScreen com dados PIX
// em vez de abrir Linking.openURL.
// Adiciona seção Galáxia Plus.
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
import { SpendableFeature, isPremiumOnly } from '../services/walletService';
import { usePremiumTools }                 from '../../premium/hooks/usePremiumTools';
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const PACK_ICONS: Record<string, string> = {
  starter: '✨',
  popular: '💎',
  supremo: '👑',
  galaxia: '🌌',
};

const GALAXIA_PLUS_BENEFITS = [
  '💜 10 Cartas do Destino por dia',
  '✨ 300 Cristais Gratuitos todo mês',
  '⚡ Faísca com bônus +20%',
  '🔓 Revelações mais baratas',
  '🏅 Badge exclusivo Galáxia',
  '📊 Ver quem visitou seu perfil',
];
// Ação de cada item — evita cobrar por efeito inexistente
//   'TURBO' / 'FERTILIZER' → CF própria que debita E ativa
//   'SPEND'                → spendCoins (só debita — exige efeito implementado)
//   'SOON'                 → sem efeito no backend, card bloqueado
type MarketAction = 'TURBO' | 'FERTILIZER' | 'IMPULSO' | 'DESTAQUE' | 'VISITORS' | 'SPEND' | 'SOON';

const MARKET_FEATURES: {
  key: SpendableFeature; icon: string; label: string; sub: string;
  cost: number; action: MarketAction;
}[] = [
  { key: 'REVEAL_VISITORS',         icon: '👁️', label: 'Ver Visitantes',    sub: 'Descubra quem visitou seu perfil', cost: 50,  action: 'VISITORS' },
  { key: 'REVEAL_QUASE_SINTONIA',   icon: '💜', label: 'Quase Sintonia',    sub: 'Revele quem quase deu match',      cost: 25,  action: 'SOON' },
  { key: 'SEGUNDA_CHANCE',          icon: '🔄', label: 'Segunda Chance',    sub: 'Reveja um perfil descartado',      cost: 15,  action: 'SOON' },
  { key: 'IMPULSO_PERFIL',          icon: '🚀', label: 'Impulso de Perfil', sub: 'Mais visibilidade por 30 min',     cost: 80,  action: 'IMPULSO' },

  { key: 'DESTAQUE_REGIONAL',       icon: '📍', label: 'Destaque Regional', sub: 'Destaque na sua região por 4h',    cost: 150, action: 'DESTAQUE' },
  { key: 'REVEAL_SINTONIA_PERDIDA', icon: '💔', label: 'Sintonia Perdida',  sub: 'Recupere uma conexão perdida',     cost: 35,  action: 'SOON' },
  { key: 'TURBO_SINTONIA',          icon: '⚡', label: 'Turbo Sintonia',    sub: 'Impulso 1.8× por 30 min',          cost: 120, action: 'TURBO' },
  { key: 'FERTILIZANTE_SINTONIA',   icon: '🌱', label: 'Fertilizante',      sub: '+50% XP da Árvore por 24h',        cost: 80,  action: 'FERTILIZER' },
];
function PackageCard({
  pkg,
  onPress,
  loading,
}: {
  pkg:     CoinPackageDisplay;
  onPress: () => void;
  loading: boolean;
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
          {pkg.bonus > 0 && (
            <Text style={styles.packageBonus}>+{pkg.bonus} bônus</Text>
          )}
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

export default function StoreScreen() {
  const navigation        = useNavigation<NavProp>();
  const { user }          = useAuth();
  const { wallet, spend } = useCoins();
  const coinsGratuitos = wallet?.coinsGratuitos ?? 0;
  const coinsPremium   = wallet?.coinsPremium   ?? 0;
  const fragments      = wallet?.fragments      ?? 0;

  const [loadingPkg,      setLoadingPkg]      = useState<string | null>(null);
  const [loadingGalaxia,  setLoadingGalaxia]  = useState(false);
  const [spending,        setSpending]        = useState<string | null>(null);

  // packageId aguardando CPF. Guardar o id (e não um booleano)
  // permite um único modal servir pacotes e Galáxia Plus.
  const [pendingPackageId, setPendingPackageId] = useState<string | null>(null);

  const {
    fertilizer, turbo, impulso, destaque, activating,
    activateFertilizer, activateTurbo, activateImpulso, activateDestaqueRegional,
  } = usePremiumTools(user?.uid);

  // Abre o modal de CPF — a cobrança só é criada após a confirmação,
  // porque o Asaas exige o CPF para gerar o customer.
  function handlePurchase(pkg: CoinPackageDisplay) {
    if (!user?.uid) return;
    setPendingPackageId(pkg.id);
  }

  function handleGalaxiaPlus() {
    if (!user?.uid) return;
    setPendingPackageId('galaxia_plus');
  }

  function handleCpfCancel() {
    setPendingPackageId(null);
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
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível iniciar o pagamento.');
    } finally {
      setLoadingPkg(null);
      setLoadingGalaxia(false);
    }
  }

  async function handleSpendFeature(item: typeof MARKET_FEATURES[number]) {
    if (!user?.uid || spending || activating) return;

    // Bloqueio de segurança: nunca cobrar por efeito que não existe
    if (item.action === 'SOON') {
      Alert.alert('Em breve', `${item.label} está sendo finalizado e chega logo.`);
      return;
    }
// A compra acontece na própria tela, com o número de visitas
    // à vista — decisão informada em vez de compra às cegas.
    if (item.action === 'VISITORS') {
      navigation.navigate('Visitors' as any);
      return;
    }
    // Turbo e Fertilizante têm CF própria que debita E ativa.
    // Usar spendCoins aqui cobraria sem ativar nada.
    if (item.action === 'TURBO') {
      if (turbo?.status === 'ACTIVE') {
        Alert.alert('Turbo já ativo', 'Aguarde o atual terminar para ativar outro.');
        return;
      }
      if (turbo?.status === 'COOLDOWN') {
        Alert.alert('Aguarde', 'Há um intervalo de 5 minutos entre ativações.');
        return;
      }
      if (coinsPremium < item.cost) {
        Alert.alert('💎 Cristais Premium insuficientes',
          `Turbo custa ${item.cost} Premium. Você tem ${coinsPremium}.`);
        return;
      }
      Alert.alert(item.label, `Ativar por ${item.cost} Cristais Premium?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ativar',
          onPress: async () => {
            const res = await activateTurbo();
            if (res.ok) {
              Alert.alert('⚡ Turbo ativado!', 'Seu perfil terá mais visibilidade nos próximos 30 minutos.');
            } else if (res.error) {
              Alert.alert('Não foi possível ativar', res.error);
            }
          },
        },
      ]);
      return;
    }

    if (item.action === 'FERTILIZER') {
      if (fertilizer?.status === 'ACTIVE') {
        Alert.alert('Fertilizante já ativo', 'Aguarde o atual terminar.');
        return;
      }
      if (coinsPremium < item.cost) {
        Alert.alert('💎 Cristais Premium insuficientes',
          `Fertilizante custa ${item.cost} Premium. Você tem ${coinsPremium}.`);
        return;
      }
      Alert.alert(item.label, `Ativar por ${item.cost} Cristais Premium?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ativar',
          onPress: async () => {
            const res = await activateFertilizer();
            if (res.ok) {
              Alert.alert('🌱 Fertilizante ativado!', 'Você ganha +50% de XP na Árvore pelas próximas 24 horas.');
            } else if (res.error) {
              Alert.alert('Não foi possível ativar', res.error);
            }
          },
        },
      ]);
      return;
    }

    if (item.action === 'IMPULSO') {
      if (impulso?.status === 'ACTIVE') {
        Alert.alert('Impulso já ativo', 'Aguarde o atual terminar para ativar outro.');
        return;
      }
      if (impulso?.status === 'COOLDOWN') {
        Alert.alert('Aguarde', 'Há um intervalo de 5 minutos entre ativações.');
        return;
      }
      // Impulso aceita gratuitos + premium (R19)
      if ((coinsGratuitos + coinsPremium) < item.cost) {
        Alert.alert('Saldo insuficiente',
          `Impulso custa ${item.cost} cristais. Você tem ${coinsGratuitos + coinsPremium}.`);
        return;
      }
      Alert.alert(item.label, `Ativar por ${item.cost} cristais?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ativar',
          onPress: async () => {
            const res = await activateImpulso();
            if (res.ok) {
              Alert.alert('🚀 Impulso ativado!', 'Seu perfil terá mais visibilidade nos próximos 30 minutos.');
            } else if (res.error) {
              Alert.alert('Não foi possível ativar', res.error);
            }
          },
        },
      ]);
      return;
    }

    if (item.action === 'DESTAQUE') {
      if (destaque?.status === 'ACTIVE') {
        Alert.alert('Destaque já ativo', 'Aguarde o atual terminar para ativar outro.');
        return;
      }
      if (destaque?.status === 'COOLDOWN') {
        Alert.alert('Aguarde', 'Há um intervalo de 5 minutos entre ativações.');
        return;
      }
      // Destaque aceita gratuitos + premium (R19)
      if ((coinsGratuitos + coinsPremium) < item.cost) {
        Alert.alert('Saldo insuficiente',
          `Destaque Regional custa ${item.cost} cristais. Você tem ${coinsGratuitos + coinsPremium}.`);
        return;
      }

      const regiao = destaque?.city && destaque?.state
        ? `${destaque.city}, ${destaque.state}`
        : 'sua região';

      // Mostrar a audiência real antes da compra vale mais que
      // qualquer piso que a gente escolha: em região cheia o
      // número vende, em região vazia ele evita o arrependimento.
      const audiencia = typeof destaque?.usersInRegion === 'number'
        ? `\n\n👥 ${destaque.usersInRegion} pessoas cadastradas na sua região.`
        : '';

      Alert.alert(
        item.label,
        `Destacar seu perfil em ${regiao} por 4 horas, por ${item.cost} cristais?${audiencia}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Ativar',
            onPress: async () => {
              const res = await activateDestaqueRegional();
              if (res.ok) {
                Alert.alert('📍 Destaque ativado!',
                  `Seu perfil aparece em evidência em ${regiao} pelas próximas 4 horas.`);
              } else if (res.error) {
                // Mensagem do servidor: guard de região, exclusividade,
                // cidade não preenchida. Cada uma orienta uma ação diferente.
                Alert.alert('Não foi possível ativar', res.error);
              }
            },
          },
        ]);
      return;
    }

    // action === 'SPEND' — apenas para features com efeito implementado
    const premiumOnly = isPremiumOnly(item.key);
    const saldo = premiumOnly ? coinsPremium : coinsGratuitos + coinsPremium;

    if (saldo < item.cost) {
      Alert.alert(
        premiumOnly ? '💎 Cristais Premium insuficientes' : 'Saldo insuficiente',
        premiumOnly
          ? `${item.label} custa ${item.cost} Cristais Premium. Você tem ${coinsPremium}.`
          : `${item.label} custa ${item.cost} cristais. Você tem ${coinsGratuitos + coinsPremium}.`
      );
      return;
    }

    Alert.alert(item.label, `Confirmar por ${item.cost} cristais?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          setSpending(item.key);
          const ok = await spend(item.key);
          setSpending(null);
          Alert.alert(
            ok ? '✨ Ativado!' : 'Erro',
            ok ? `${item.label} foi ativado com sucesso.` : 'Não foi possível concluir. Tente novamente.'
          );
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Header title="Cristais de Sintonia" showBack={true} showHome={true} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Saldo atual */}
        <LinearGradient colors={['#1A0A2E','#2D1B4E']} style={styles.balanceCard}>
          <Text style={styles.balanceTitle}>✨ CRISTAIS DE SINTONIA</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceValue}>{coinsGratuitos ?? 0}</Text>
              <Text style={styles.balanceLabel}>GRATUITOS</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceStat}>
              <Text style={[styles.balanceValue, styles.balanceValuePremium]}>
                {coinsPremium ?? 0}
              </Text>
              <Text style={styles.balanceLabel}>PREMIUM 💎</Text>
            </View>
          </View>
          {(fragments ?? 0) > 0 && (
            <TouchableOpacity style={styles.fragmentsRow}>
              <Text style={styles.fragmentsText}>
                🔮 {fragments} Fragmentos · = {Math.floor((fragments ?? 0) / 100)} cristais · Toque para converter
              </Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* Galáxia Plus */}
        <Text style={styles.sectionTitle}>💜 Galáxia Plus</Text>
        <TouchableOpacity
          style={styles.galaxiaCard}
          onPress={handleGalaxiaPlus}
          disabled={loadingGalaxia}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#2A0A4E','#4E1B7E']} style={styles.galaxiaInner}>
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
              {GALAXIA_PLUS_BENEFITS.map((benefit, i) => (
                <Text key={i} style={styles.galaxiaBenefit}>{benefit}</Text>
              ))}
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Pacotes de Cristais */}
        <Text style={styles.sectionTitle}>💎 Pacotes de Cristais</Text>
        <Text style={styles.sectionSub}>Cristais Premium desbloqueiam recursos exclusivos</Text>
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

        {/* Mercado Cósmico */}
        <Text style={styles.sectionTitle}>🌌 Mercado Cósmico</Text>
        <Text style={styles.sectionSub}>💎 = exige Cristais Premium exclusivamente</Text>
        <View style={styles.marketSection}>
         {MARKET_FEATURES.map(item => {
            const premiumOnly = isPremiumOnly(item.key);
            const isSoon      = item.action === 'SOON';
            const isBusy      = spending === item.key
              || (item.action === 'TURBO'      && activating === 'TURBO')
              || (item.action === 'FERTILIZER' && activating === 'FERTILIZER')
              || (item.action === 'IMPULSO'    && activating === 'IMPULSO')
              || (item.action === 'DESTAQUE'   && activating === 'DESTAQUE');
            const isActive    = (item.action === 'TURBO'      && turbo?.status === 'ACTIVE')
              || (item.action === 'FERTILIZER' && fertilizer?.status === 'ACTIVE')
              || (item.action === 'IMPULSO'    && impulso?.status === 'ACTIVE')
              || (item.action === 'DESTAQUE'   && destaque?.status === 'ACTIVE');
            const canAfford   = premiumOnly
              ? coinsPremium >= item.cost
              : (coinsGratuitos + coinsPremium) >= item.cost;

            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.marketCard,
                  premiumOnly && styles.marketCardPremium,
                  (!canAfford || isSoon) && styles.marketCardLocked,
                  isActive && styles.marketCardActive,
                ]}
                onPress={() => handleSpendFeature(item)}
                disabled={isBusy}
                activeOpacity={0.85}
              >
                <Text style={styles.marketIcon}>{item.icon}</Text>
                <View style={styles.marketInfo}>
                  <Text style={styles.marketLabel}>{item.label}</Text>
                  <Text style={styles.marketSub}>
                    {isActive ? 'Ativo agora ✓' : item.sub}
                  </Text>
                </View>
                {isBusy ? (
                  <ActivityIndicator color={COLORS.secondary} />
                ) : isSoon ? (
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonBadgeText}>Em breve</Text>
                  </View>
                ) : isActive ? (
                  <Text style={styles.marketActiveText}>ATIVO</Text>
                ) : (
                  <Text style={[styles.marketCost, premiumOnly && styles.marketCostPremium]}>
                    {premiumOnly ? '💎' : '✨'} {item.cost}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ Sobre os Cristais</Text>
          <Text style={styles.infoText}>• Cristais Gratuitos: ganhos por engajamento diário</Text>
          <Text style={styles.infoText}>• Cristais Premium: comprados e desbloqueiam recursos exclusivos</Text>
          <Text style={styles.infoText}>• Pagamento 100% seguro via PIX</Text>
          <Text style={styles.infoText}>• Cristais não expiram após a compra</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <CpfPromptModal
        visible={pendingPackageId !== null}
        loading={loadingGalaxia || loadingPkg !== null}
        onConfirm={handleCpfConfirm}
        onCancel={handleCpfCancel}
      />
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: COLORS.background },
  balanceCard:            { margin: S.md, borderRadius: R.xl, padding: S.xl, gap: S.md, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)' },
  balanceTitle:           { color: COLORS.secondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extrabold, textAlign: 'center', letterSpacing: 2 },
  balanceRow:             { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  balanceStat:            { alignItems: 'center', gap: 4 },
  balanceValue:           { color: COLORS.surface, fontSize: 40, fontWeight: FONT_WEIGHT.extrabold },
  balanceValuePremium:    { color: '#FFD700' },
  balanceLabel:           { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, letterSpacing: 1 },
  balanceDivider:         { width: 1, height: 40, backgroundColor: COLORS.border },
  fragmentsRow:           { backgroundColor: 'rgba(181,123,238,0.1)', borderRadius: R.full, padding: S.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.secondary + '44' },
  fragmentsText:          { color: COLORS.secondary, fontSize: FONT_SIZE.xs, textAlign: 'center' },
  sectionTitle:           { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginTop: S.lg, marginBottom: S.xs },
  sectionSub:             { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginHorizontal: S.md, marginBottom: S.sm },
  galaxiaCard:            { marginHorizontal: S.md, marginBottom: S.md, borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.secondary + '66' },
  galaxiaInner:           { padding: S.lg, gap: S.md },
  galaxiaHeader:          { flexDirection: 'row', alignItems: 'center', gap: S.md },
  galaxiaIcon:            { fontSize: 36 },
  galaxiaInfo:            { flex: 1 },
  galaxiaTitle:           { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extrabold },
  galaxiaPrice:           { color: COLORS.secondary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  galaxiaArrow:           { color: COLORS.secondary, fontSize: 28, fontWeight: FONT_WEIGHT.bold },
  galaxiaBenefits:        { gap: S.xs },
  galaxiaBenefit:         { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, lineHeight: 20 },
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
  marketSection:          { marginHorizontal: S.md, gap: S.sm },
  marketCard:             { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.md, gap: S.md, borderWidth: 1, borderColor: COLORS.border },
  marketCardPremium:      { borderColor: '#FFD70055', backgroundColor: 'rgba(255,215,0,0.04)' },
  marketCardLocked:       { opacity: 0.45 },
  marketIcon:             { fontSize: 26 },
  marketInfo:             { flex: 1 },
  marketLabel:            { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  marketSub:              { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  marketCost:             { color: COLORS.secondary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extrabold },
  marketCostPremium:      { color: '#FFD700' },
  marketCardActive:       { borderColor: '#44FF88', backgroundColor: 'rgba(68,255,136,0.06)' },
  marketActiveText:       { color: '#44FF88', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extrabold, letterSpacing: 1 },
  soonBadge:              { backgroundColor: COLORS.border, borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 2 },
  soonBadgeText:          { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  infoCard:               { marginHorizontal: S.md, marginTop: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.lg, gap: S.xs, borderWidth: 1, borderColor: COLORS.border },
  infoTitle:              { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  infoText:               { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, lineHeight: 18 },
});
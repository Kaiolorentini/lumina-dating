// ============================================
// LUMINA — STORE SCREEN v5.2
// src/modules/economy/screens/StoreScreen.tsx
//
// v5.2: Botão de Fragmentos adicionado
// ============================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { useNavigation }   from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }   from '../../../context/AuthContext';
import { useCoins }  from '../../../context/CoinsContext';
import {
  COIN_PACKAGES_DISPLAY,
  initiatePurchase,
  getTransactions,
} from '../../../services/coinsService';
import {
  COLORS, GRADIENTS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, colors, alpha,
} from '../../../theme/tokens';
import Header        from '../../../components/Header';
import { Transaction } from '../../../shared/types';
import { formatRelativeTime } from '../../../shared/utils';
import { RootStackParamList } from '../../../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const MARKET_FEATURES = [
  { key: 'REVEAL_VISITORS',         icon: '👁️', label: 'Ver Visitantes',       cost: 50,  premium: false },
  { key: 'REVEAL_QUASE_SINTONIA',   icon: '💜', label: 'Quase Sintonia',       cost: 25,  premium: false },
  { key: 'REVEAL_SINTONIA_PERDIDA', icon: '💔', label: 'Sintonia Perdida',     cost: 35,  premium: true  },
  { key: 'IMPULSO_PERFIL',          icon: '🚀', label: 'Impulso de Perfil',    cost: 80,  premium: false },
  { key: 'TURBO_SINTONIA',          icon: '⚡', label: 'Turbo Sintonia',       cost: 120, premium: true  },
  { key: 'SEGUNDA_CHANCE',          icon: '🔄', label: 'Segunda Chance',       cost: 15,  premium: false },
  { key: 'DESTAQUE_REGIONAL',       icon: '📍', label: 'Destaque Regional',    cost: 150, premium: false },
  { key: 'FERTILIZANTE_SINTONIA',   icon: '🌱', label: 'Fertilizante Árvore', cost: 80,  premium: true  },
] as const;

const GALAXIA_PLUS_BENEFITS = [
  '500 Cristais mensais',
  '10 Cartas do Destino/dia',
  'Sintonia Perdida grátis',
  '1 Turbo Sintonia/semana',
  'Badge Galáxia exclusivo',
  'Prioridade no algoritmo',
];

export default function StoreScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { wallet, loading } = useCoins();

  const [purchasing,     setPurchasing]     = useState<string | null>(null);
  const [transactions,   setTransactions]   = useState<Transaction[]>([]);
  const [showHistory,    setShowHistory]    = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handlePurchase = useCallback(async (packageId: string) => {
    if (!user) return;
    const pkg = COIN_PACKAGES_DISPLAY.find((p: typeof COIN_PACKAGES_DISPLAY[number]) => p.id === packageId);
    if (!pkg) return;

    const isFirst      = !wallet?.firstPurchaseDone && pkg.isFirstPurchasePkg;
    const totalDisplay = isFirst ? pkg.total + 100 : pkg.total;

    Alert.alert(
      '✨ Confirmar compra',
      `${pkg.label}\n${totalDisplay} Cristais Premium\n${pkg.priceLabel}${isFirst ? '\n\n🎁 +100 bônus de primeira compra!' : ''}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Comprar agora',
          onPress: async () => {
            try {
              setPurchasing(packageId);
              const result = await initiatePurchase(packageId);
              if (result.success && result.checkoutUrl) {
                Alert.alert('🔗 Pagamento', 'Redirecionando para o pagamento seguro.');
              } else {
                Alert.alert('Erro', result.error ?? 'Não foi possível iniciar o pagamento.');
              }
            } catch {
              Alert.alert('Erro', 'Não foi possível completar a compra.');
            } finally {
              setPurchasing(null);
            }
          },
        },
      ]
    );
  }, [user, wallet]);

  const handleShowHistory = useCallback(async () => {
    if (!user) return;
    const next = !showHistory;
    setShowHistory(next);
    if (next && transactions.length === 0) {
      setLoadingHistory(true);
      const trans = await getTransactions(user.uid);
      setTransactions(trans);
      setLoadingHistory(false);
    }
  }, [user, showHistory, transactions.length]);

  const S = SPACING;
  const R = BORDER_RADIUS;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Header title="Mercado de Cristais" showBack={true} showHome={true} />

      {/* SALDO */}
      <LinearGradient colors={[colors.cardLegacy, '#2D1B4E']} style={styles.walletCard}>
        <Text style={styles.walletTitle}>✨ Cristais de Sintonia</Text>
        <View style={styles.walletRow}>
          <View style={styles.walletItem}>
            <View style={styles.crystalDot} />
            {loading
              ? <ActivityIndicator color={COLORS.secondary} size="small" />
              : <Text style={styles.walletAmount}>{wallet?.coinsGratuitos ?? 0}</Text>
            }
            <Text style={styles.walletItemLabel}>Gratuitos</Text>
          </View>
          <View style={styles.walletDivider} />
          <View style={styles.walletItem}>
            <View style={[styles.crystalDot, styles.crystalDotPremium]} />
            {loading
              ? <ActivityIndicator color={COLORS.premium} size="small" />
              : <Text style={[styles.walletAmount, styles.amountPremium]}>{wallet?.coinsPremium ?? 0}</Text>
            }
            <Text style={[styles.walletItemLabel, styles.labelPremium]}>Premium 💎</Text>
          </View>
        </View>

        {/* Fragmentos com botão de conversão */}
        {(wallet?.fragments ?? 0) > 0 && (
          <TouchableOpacity
            style={styles.fragmentsBtn}
            onPress={() => navigation.navigate('Fragments' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.fragmentsBtnText}>
              🔮 {wallet?.fragments ?? 0} Fragmentos
            </Text>
            <Text style={styles.fragmentsBtnSub}>
              = {Math.floor((wallet?.fragments ?? 0) / 100)} cristal{Math.floor((wallet?.fragments ?? 0) / 100) !== 1 ? 'is' : ''} · Toque para converter
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.historyBtn} onPress={handleShowHistory}>
          <Text style={styles.historyBtnText}>
            {showHistory ? 'Fechar histórico' : '📋 Ver histórico'}
          </Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* HISTÓRICO */}
      {showHistory && (
        <View style={styles.historyContainer}>
          {loadingHistory ? (
            <ActivityIndicator color={COLORS.secondary} style={{ marginTop: 16 }} />
          ) : transactions.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma transação ainda</Text>
          ) : (
            transactions.map(trans => (
              <View key={trans.id} style={styles.transactionItem}>
                <Text style={styles.transactionIcon}>{trans.type === 'earn' ? '⬆️' : '⬇️'}</Text>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDesc}>{trans.description}</Text>
                  <View style={styles.transactionMeta}>
                    <Text style={styles.transactionDate}>{formatRelativeTime(trans.timestamp)}</Text>
                    <Text style={[
                      styles.transactionCoinType,
                      { color: trans.coinTipo === 'premium' ? COLORS.premium : COLORS.secondary },
                    ]}>
                      {trans.coinTipo === 'premium' ? '💎 Premium' : '✨ Gratuito'}
                    </Text>
                  </View>
                </View>
                <Text style={[
                  styles.transactionAmount,
                  { color: trans.type === 'earn' ? COLORS.success : COLORS.error },
                ]}>
                  {trans.type === 'earn' ? '+' : '-'}{Math.abs(trans.amount)}
                </Text>
              </View>
            ))
          )}
        </View>
      )}

      {/* PACOTES */}
      <Text style={styles.sectionTitle}>💎 Pacotes de Cristais</Text>
      <Text style={styles.sectionSub}>Cristais Premium desbloqueiam recursos exclusivos</Text>

      {COIN_PACKAGES_DISPLAY.map((pkg: typeof COIN_PACKAGES_DISPLAY[number]) => {
        const isFirst      = !wallet?.firstPurchaseDone && pkg.isFirstPurchasePkg;
        const totalDisplay = isFirst ? pkg.total + 100 : pkg.total;
        return (
          <TouchableOpacity
            key={pkg.id}
            style={[styles.packageCard, pkg.highlighted && styles.packageHighlighted]}
            onPress={() => handlePurchase(pkg.id)}
            disabled={purchasing === pkg.id}
            activeOpacity={0.85}
          >
            {pkg.highlighted && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>⭐ MAIS POPULAR</Text>
              </View>
            )}
            {isFirst && (
              <View style={[styles.badge, styles.badgeFirst]}>
                <Text style={styles.badgeText}>🎁 PRIMEIRA COMPRA</Text>
              </View>
            )}
            <View style={styles.packageLeft}>
              <View style={styles.packageIconBox}>
                <Text style={styles.packageEmoji}>
                  {pkg.id === 'starter' ? '💠' : pkg.id === 'popular' ? '💎' : pkg.id === 'supremo' ? '👑' : '✨'}
                </Text>
              </View>
              <View>
                <Text style={styles.packageLabel}>{pkg.label}</Text>
                <Text style={styles.packageCoins}>
                  {totalDisplay} Cristais Premium
                  {pkg.bonus > 0 && !isFirst && <Text style={styles.packageBonus}> (+{pkg.bonus} bônus)</Text>}
                  {isFirst && <Text style={styles.packageBonus}> (+100 bônus 🎁)</Text>}
                </Text>
              </View>
            </View>
            <View>
              {purchasing === pkg.id
                ? <ActivityIndicator color={COLORS.premium} />
                : <Text style={[styles.packagePrice, pkg.highlighted && styles.packagePriceHL]}>{pkg.priceLabel}</Text>
              }
            </View>
          </TouchableOpacity>
        );
      })}

      {/* MERCADO CÓSMICO */}
      <Text style={styles.sectionTitle}>🌌 Mercado Cósmico</Text>
      <Text style={styles.sectionSub}>💎 = Requer Cristais Premium exclusivamente</Text>
      <View style={styles.marketGrid}>
        {MARKET_FEATURES.map(f => (
          <View key={f.key} style={[styles.marketItem, f.premium && styles.marketItemPremium]}>
            <Text style={styles.marketIcon}>{f.icon}</Text>
            <Text style={styles.marketLabel}>{f.label}</Text>
            <Text style={[styles.marketCost, f.premium && styles.marketCostPremium]}>
              {f.premium ? '💎' : '✨'} {f.cost}
            </Text>
          </View>
        ))}
      </View>

      {/* GALÁXIA PLUS */}
      <LinearGradient
        colors={GRADIENTS.galaxia as [string, string, string]}
        style={styles.galaxiaCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.galaxiaTitle}>💜 Galáxia Plus</Text>
        <Text style={styles.galaxiaPrice}>R$ 19,90/mês</Text>
        <View style={styles.galaxiaBenefits}>
          {GALAXIA_PLUS_BENEFITS.map((b, i) => (
            <Text key={i} style={styles.galaxiaBenefit}>✦ {b}</Text>
          ))}
        </View>
        <TouchableOpacity
          style={styles.galaxiaBtn}
          onPress={() => Alert.alert('Em breve', 'Galáxia Plus em breve!')}
        >
          <Text style={styles.galaxiaBtnText}>Assinar Galáxia Plus</Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: COLORS.background },
  walletCard:          { margin: S.md, borderRadius: R.xl, padding: S.lg, borderWidth: 1, borderColor: alpha(colors.secondaryLegacy, 0.3) },
  walletTitle:         { color: COLORS.secondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase', marginBottom: S.md },
  walletRow:           { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  walletItem:          { alignItems: 'center', gap: S.xs, flex: 1 },
  walletDivider:       { width: 1, height: 50, backgroundColor: alpha(colors.secondaryLegacy, 0.3) },
  crystalDot:          { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  crystalDotPremium:   { backgroundColor: COLORS.premium },
  walletAmount:        { color: COLORS.surface, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold },
  amountPremium:       { color: COLORS.premium },
  walletItemLabel:     { color: COLORS.secondary, fontSize: FONT_SIZE.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelPremium:        { color: COLORS.premium },
  // Fragmentos
  fragmentsBtn:        { marginTop: S.md, backgroundColor: alpha(colors.primaryLegacy, 0.15), borderRadius: R.lg, padding: S.md, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: alpha(colors.primaryLegacy, 0.4) },
  fragmentsBtnText:    { color: COLORS.secondary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  fragmentsBtnSub:     { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  historyBtn:          { marginTop: S.md, alignSelf: 'center', paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: R.full, borderWidth: 1, borderColor: alpha(colors.secondaryLegacy, 0.4) },
  historyBtnText:      { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  historyContainer:    { marginHorizontal: S.md, marginBottom: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: COLORS.border },
  transactionItem:     { flexDirection: 'row', alignItems: 'center', paddingVertical: S.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: S.sm },
  transactionIcon:     { fontSize: FONT_SIZE.xl },
  transactionInfo:     { flex: 1 },
  transactionDesc:     { color: COLORS.surface, fontSize: FONT_SIZE.sm },
  transactionMeta:     { flexDirection: 'row', gap: S.sm, alignItems: 'center', marginTop: 2 },
  transactionDate:     { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  transactionCoinType: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
  transactionAmount:   { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extrabold },
  sectionTitle:        { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginTop: S.xl, marginBottom: S.xs },
  sectionSub:          { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginHorizontal: S.md, marginBottom: S.md },
  packageCard:         { marginHorizontal: S.md, marginBottom: S.sm, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.lg, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  packageHighlighted:  { borderColor: COLORS.premium, backgroundColor: alpha(colors.goldLegacy, 0.05) },
  badge:               { position: 'absolute', top: -10, left: S.md, backgroundColor: COLORS.premium, borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 2 },
  badgeFirst:          { left: undefined, right: S.md, backgroundColor: COLORS.primary },
  badgeText:           { color: COLORS.background, fontSize: 9, fontWeight: FONT_WEIGHT.bold },
  packageLeft:         { flexDirection: 'row', alignItems: 'center', gap: S.md, flex: 1 },
  packageIconBox:      { width: 48, height: 48, borderRadius: R.md, backgroundColor: alpha(colors.primaryLegacy, 0.2), alignItems: 'center', justifyContent: 'center' },
  packageEmoji:        { fontSize: 24 },
  packageLabel:        { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  packageCoins:        { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  packageBonus:        { color: COLORS.premium, fontWeight: FONT_WEIGHT.bold },
  packagePrice:        { color: COLORS.secondary, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extrabold },
  packagePriceHL:      { color: COLORS.premium },
  marketGrid:          { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: S.md, gap: S.sm, marginBottom: S.md },
  marketItem:          { width: '47%', backgroundColor: COLORS.card, borderRadius: R.md, padding: S.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, gap: S.xs },
  marketItemPremium:   { borderColor: alpha(colors.goldLegacy, 0.3), backgroundColor: alpha(colors.goldLegacy, 0.03) },
  marketIcon:          { fontSize: 26 },
  marketLabel:         { color: COLORS.surface, fontSize: FONT_SIZE.xs, textAlign: 'center', fontWeight: FONT_WEIGHT.medium },
  marketCost:          { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  marketCostPremium:   { color: COLORS.premium },
  galaxiaCard:         { margin: S.md, borderRadius: R.xl, padding: S.xl, borderWidth: 1, borderColor: alpha(colors.primaryLegacy, 0.5) },
  galaxiaTitle:        { color: COLORS.surface, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold, textAlign: 'center' },
  galaxiaPrice:        { color: COLORS.premium, fontSize: FONT_SIZE.hero, fontWeight: FONT_WEIGHT.extrabold, textAlign: 'center', marginTop: S.xs, marginBottom: S.lg },
  galaxiaBenefits:     { gap: S.sm, marginBottom: S.xl },
  galaxiaBenefit:      { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.medium },
  galaxiaBtn:          { backgroundColor: COLORS.primary, borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center' },
  galaxiaBtnText:      { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5 },
  emptyText:           { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', marginTop: S.md },
});
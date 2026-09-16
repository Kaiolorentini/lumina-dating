// ============================================
// LUMINA — BADGES SHOP SCREEN v2.0
// src/modules/economy/screens/BadgesShopScreen.tsx
//
// FASE 8 — 20 badges de intenção, em grid.
//
// v2.0: o catálogo local foi REMOVIDO. A tela agora lê de
// src/config/cosmeticsCatalog.ts, fonte única — a cópia daqui já
// tinha divergido dos preços do servidor depois do redesenho.
//
// Duas moedas, dois regimes:
//   fragmentos → PERMANENTES, porta de entrada
//   cristais   → aluguel de 30 dias, recompra soma os dias
// ============================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions,
} from 'react-native';
import { useNavigation }    from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }          from '../../../context/AuthContext';
import { useCoins }         from '../../../context/CoinsContext';
import { useBadges }        from '../../engagement/hooks/useBadges';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { Badge } from '../../../components/profile/Badge';
import {
  FRAGMENT_BADGES, CRYSTAL_BADGES, BadgeLook,
  RARITY_LABEL, RARITY_COLOR,
} from '../../../config/cosmeticsCatalog';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';
import { SpendableFeature } from '../services/walletService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function BadgesShopScreen() {
  const navigation        = useNavigation<NavProp>();
  const { user }          = useAuth();
  const { wallet, spend, refreshWallet } = useCoins();
  const { buyWithFragments, buying: buyingFrag, refresh } = useBadges(user?.uid);
  const { width }         = useWindowDimensions();

  const coinsPremium = wallet?.coinsPremium ?? 0;
  const fragments    = wallet?.fragments    ?? 0;

  const [buyingCrystal, setBuyingCrystal] = useState<string | null>(null);

  const columns   = width >= 560 ? 3 : 2;
  const cardWidth: `${number}%` = columns === 3 ? '31.5%' : '48%';

  function goToMyBadges() {
    navigation.navigate('Badges' as any);
  }

  async function handleBuy(offer: BadgeLook) {
    if (!user?.uid || buyingCrystal || buyingFrag) return;

    const isFragments = offer.currency === 'FRAGMENTS';
    const balance     = isFragments ? fragments : coinsPremium;
    const symbol      = isFragments ? '🔮' : '💎';
    const coinName    = isFragments ? 'Fragmentos' : 'Cristais Premium';

    if (balance < offer.price) {
      Alert.alert(
        `${symbol} ${coinName} insuficientes`,
        `${offer.title} custa ${offer.price}. Você tem ${balance}.`,
        isFragments
          ? [{ text: 'Fechar', style: 'cancel' }]
          : [
              { text: 'Fechar', style: 'cancel' },
              { text: 'Comprar cristais', onPress: () => navigation.navigate('CrystalPacks' as any) },
            ]
      );
      return;
    }

    // O regime aparece ANTES da confirmação: permanente e aluguel
    // custam parecido e têm valor muito diferente.
    const duracao = isFragments
      ? 'Este badge é seu para sempre.'
      : 'Vale 30 dias. Se você já tiver este badge ativo, os dias somam.';

    Alert.alert(
      offer.title,
      `"${offer.meaning}"\n\n${duracao}\n\nAdquirir por ${offer.price} ${coinName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Adquirir',
          onPress: async () => {
            let ok = false;

            if (isFragments) {
              const res = await buyWithFragments(offer.id);
              ok = res.ok;
              if (!ok && res.error) {
                Alert.alert('Não foi possível', res.error);
                return;
              }
            } else if (offer.costKey) {
              setBuyingCrystal(offer.id);
              ok = await spend(offer.costKey as SpendableFeature);
              setBuyingCrystal(null);
            }

            if (ok) {
              await refreshWallet();
              await refresh();
              Alert.alert(
                '✦ Badge adquirido!',
                `${offer.title} ${isFragments ? 'é seu.' : 'é seu por 30 dias.'}`,
                [
                  { text: 'Depois', style: 'cancel' },
                  { text: 'Escolher agora', onPress: goToMyBadges },
                ]
              );
            } else if (!isFragments) {
              Alert.alert('Erro', 'Não foi possível concluir. Tente novamente.');
            }
          },
        },
      ]
    );
  }

  function renderSection(title: string, sub: string, offers: BadgeLook[]) {
    return (
      <>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSub}>{sub}</Text>
        <View style={styles.grid}>
          {offers.map(offer => {
            const isFragments = offer.currency === 'FRAGMENTS';
            const balance     = isFragments ? fragments : coinsPremium;
            const canAfford   = balance >= offer.price;
            const isBusy      = buyingCrystal === offer.id || buyingFrag === offer.id;
            const rarityColor = RARITY_COLOR[offer.rarity];

            return (
              <TouchableOpacity
                key={offer.id}
                style={[
                  styles.card,
                  { width: cardWidth, borderColor: rarityColor + '44' },
                  !canAfford && styles.cardLocked,
                ]}
                onPress={() => handleBuy(offer)}
                disabled={isBusy}
                activeOpacity={0.85}
              >
                <View style={[styles.rarityStrip, { backgroundColor: rarityColor }]} />

                <View style={styles.badgeBox}>
                  <Badge
                    appearance={{
                      shape:       offer.shape,
                      coreColor:   offer.coreColor,
                      accentColor: offer.accentColor,
                      glowColor:   offer.glowColor,
                      motion:      offer.motion,
                    }}
                    size={72}
                    dimmed={!canAfford}
                  />
                </View>

                <Text style={styles.cardTitle} numberOfLines={1}>{offer.title}</Text>
                <Text style={[styles.cardRarity, { color: rarityColor }]}>
                  {RARITY_LABEL[offer.rarity]}
                </Text>

                {/* O significado é o produto. Três linhas porque
                    cortar a frase no meio mata o sentido. */}
                <Text style={styles.cardMeaning} numberOfLines={3}>
                  {offer.meaning}
                </Text>

                {offer.rentalDays === 0 && (
                  <Text style={styles.permanentTag}>✦ para sempre</Text>
                )}

                {isBusy
                  ? <ActivityIndicator color={COLORS.secondary} size="small" />
                  : <View style={[
                      styles.priceTag,
                      isFragments ? styles.priceTagFrag : styles.priceTagCrystal,
                    ]}>
                      <Text style={[
                        styles.priceText,
                        isFragments ? styles.priceTextFrag : styles.priceTextCrystal,
                      ]}>
                        {isFragments ? '🔮' : '💎'} {offer.price}
                      </Text>
                    </View>
                }
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Badges" showBack={true} showHome={true} />
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.topBar}>
          <View style={styles.balances}>
            <Text style={styles.balanceFrag}>🔮 {fragments}</Text>
            <Text style={styles.balanceCrystal}>💎 {coinsPremium}</Text>
          </View>
          <TouchableOpacity onPress={goToMyBadges}>
            <Text style={styles.myItemsLink}>Meus badges ›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Badges dizem quem você é e o que procura — e aparecem no seu perfil
            para quem te encontrar.
          </Text>
        </View>

        {renderSection(
          '🔮 Com Fragmentos',
          'Permanentes. Ganhe fragmentos em missões, conquistas e no Cofre',
          FRAGMENT_BADGES,
        )}

        {renderSection(
          '💎 Com Cristais Premium',
          '30 dias de uso · recompra soma os dias',
          CRYSTAL_BADGES,
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  topBar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: S.md, marginTop: S.md },
  balances:        { flexDirection: 'row', gap: S.md },
  balanceFrag:     { color: COLORS.secondary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extrabold },
  balanceCrystal:  { color: '#FFD700', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extrabold },
  myItemsLink:     { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  notice:          { marginHorizontal: S.md, marginTop: S.md, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: COLORS.border },
  noticeText:      { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, lineHeight: 17 },
  sectionTitle:    { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginTop: S.lg, marginBottom: S.xs },
  sectionSub:      { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginHorizontal: S.md, marginBottom: S.md },
  grid:            { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginHorizontal: S.md },
  card:            { alignItems: 'center', gap: 3, backgroundColor: COLORS.card, borderRadius: R.lg, paddingTop: S.lg, paddingBottom: S.md, paddingHorizontal: S.sm, borderWidth: 1, marginBottom: S.sm, overflow: 'hidden' },
  cardLocked:      { opacity: 0.5 },
  rarityStrip:     { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  badgeBox:        { height: 78, justifyContent: 'center' },
  cardTitle:       { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  cardRarity:      { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1 },
  cardMeaning:     { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center', minHeight: 42, lineHeight: 14, marginTop: 2 },
  permanentTag:    { color: '#FFD700', fontSize: 9, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5 },
  priceTag:        { borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: 4, borderWidth: 1, marginTop: 4 },
  priceTagFrag:    { backgroundColor: 'rgba(181,123,238,0.1)', borderColor: 'rgba(181,123,238,0.35)' },
  priceTagCrystal: { backgroundColor: 'rgba(255,215,0,0.1)',   borderColor: 'rgba(255,215,0,0.35)' },
  priceText:       { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.extrabold },
  priceTextFrag:   { color: COLORS.secondary },
  priceTextCrystal:{ color: '#FFD700' },
});
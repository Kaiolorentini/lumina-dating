// ============================================
// LUMINA — FRAMES SHOP SCREEN v1.0
// src/modules/economy/screens/FramesShopScreen.tsx
//
// FASE 7 — vitrine de molduras em GRID.
//
// Substitui o carrossel horizontal do StoreScreen: todos os
// itens visíveis de uma vez, sem arrastar para descobrir o que
// existe. Carrossel esconde metade do acervo, e o que não se vê
// não se compra.
//
// RESPONSIVO: 2 colunas por padrão, 3 a partir de 560px.
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
import { useProfile }       from '../../profile/hooks/useProfile';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { ProfileFrame } from '../../../components/profile/ProfileFrame';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';
import { SpendableFeature } from '../services/walletService';
import {
  PURCHASABLE_FRAMES, FrameLook, frameAppearanceById,
  RARITY_LABEL, RARITY_COLOR,
} from '../../../config/cosmeticsCatalog';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// O catálogo local foi removido na FASE 8: a cópia daqui divergiu
// dos preços do servidor e o mesmo erro estava prestes a se
// repetir nos badges. Fonte única em src/config/cosmeticsCatalog.

export default function FramesShopScreen() {
  const navigation        = useNavigation<NavProp>();
  const { user }          = useAuth();
  const { wallet, spend, refreshWallet } = useCoins();
  const { profile }       = useProfile();
  const { width }         = useWindowDimensions();

  const coinsPremium = wallet?.coinsPremium ?? 0;
  const photoURL     = profile?.photoURL ?? '';

  const [buying, setBuying] = useState<string | null>(null);

  // Uma coluna abaixo de 400px: com a cena em 116px, dois cards
  // lado a lado espremem a moldura e ela deixa de vender.
  const columns = width >= 560 ? 3 : width >= 400 ? 2 : 1;
  const cardWidth: `${number}%` =
    columns === 3 ? '31.5%' : columns === 2 ? '48%' : '100%';

  async function handleBuy(offer: FrameLook) {
    if (!user?.uid || buying) return;

    if (coinsPremium < offer.price) {
      Alert.alert(
        '💎 Cristais Premium insuficientes',
        `${offer.title} custa ${offer.price} Premium. Você tem ${coinsPremium}.`,
        [
          { text: 'Fechar', style: 'cancel' },
          { text: 'Comprar cristais', onPress: () => navigation.navigate('CrystalPacks' as any) },
        ]
      );
      return;
    }

    // Aluguel: dizer que é aluguel ANTES de cobrar. Cobrar 30 dias
    // sem avisar é a reclamação que não queremos receber.
    Alert.alert(
      offer.title,
      `"${offer.description}"\n\n` +
      `Usar esta moldura por 30 dias, por ${offer.price} Cristais Premium?\n` +
      `Se você já tiver esta moldura ativa, os 30 dias somam ao tempo restante.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Adquirir',
          onPress: async () => {
            setBuying(offer.id);
            const ok = await spend(offer.costKey as SpendableFeature);
            setBuying(null);
            if (ok) {
              await refreshWallet();
              // Levar, não instruir: o usuário acabou de pagar e
              // precisa escolher o que usar.
              Alert.alert(
                '🖼️ Moldura adquirida!',
                `${offer.title} é sua por 30 dias.`,
                [
                  { text: 'Depois', style: 'cancel' },
                  { text: 'Escolher agora', onPress: () => navigation.navigate('Frames' as any) },
                ]
              );
            } else {
              Alert.alert('Erro', 'Não foi possível concluir. Tente novamente.');
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Molduras" showBack={true} showHome={true} />
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.topBar}>
          <Text style={styles.balanceText}>💎 {coinsPremium}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Frames' as any)}>
            <Text style={styles.myItemsLink}>Minhas molduras ›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionSub}>
          30 dias de uso · recompra soma os dias · molduras permanentes se ganham jogando
        </Text>

        <View style={styles.grid}>
          {PURCHASABLE_FRAMES.map(offer => {
            const canAfford   = coinsPremium >= offer.price;
            const isBusy      = buying === offer.id;
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

                {/* 116px: acima do corte de 80 do ProfileFrame, e
                    é aqui que a cena precisa aparecer — em 64px
                    todas as molduras ficavam idênticas.
                    O appearance vem do catálogo pelo id; montar à
                    mão omitia o `scene` e a cena nunca desenhava. */}
                <ProfileFrame
                  photoURL={photoURL}
                  size={116}
                  frame={frameAppearanceById(offer.id)}
                />

                <Text style={styles.cardTitle} numberOfLines={1}>{offer.title}</Text>
                <Text style={[styles.cardRarity, { color: rarityColor }]}>
                  {RARITY_LABEL[offer.rarity]}
                </Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{offer.description}</Text>

                {isBusy
                  ? <ActivityIndicator color={COLORS.secondary} size="small" />
                  : <View style={styles.priceTag}>
                      <Text style={styles.priceText}>💎 {offer.price}</Text>
                    </View>
                }
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.background },
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: S.md, marginTop: S.md },
  balanceText:   { color: '#FFD700', fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extrabold },
  myItemsLink:   { color: COLORS.secondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  sectionSub:    { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginHorizontal: S.md, marginTop: S.sm, marginBottom: S.md, lineHeight: 16 },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginHorizontal: S.md },
  card:          { alignItems: 'center', gap: S.xs, backgroundColor: COLORS.card, borderRadius: R.lg, paddingTop: S.lg, paddingBottom: S.md, paddingHorizontal: S.sm, borderWidth: 1, marginBottom: S.sm, overflow: 'hidden' },
  cardLocked:    { opacity: 0.45 },
  rarityStrip:   { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  cardTitle:     { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, textAlign: 'center', marginTop: S.xs },
  cardRarity:    { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1 },
  cardDesc:      { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center', minHeight: 28, lineHeight: 14 },
  priceTag:      { backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)', marginTop: 2 },
  priceText:     { color: '#FFD700', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.extrabold },
});
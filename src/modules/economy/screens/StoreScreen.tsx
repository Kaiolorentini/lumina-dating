// ============================================
// LUMINA — STORE SCREEN v6.1
// src/modules/economy/screens/StoreScreen.tsx
//
// v6.1 — GALÁXIA PLUS PELO SERVIDOR.
//
// O card anunciava "R$ 19,90/mês", 10 Cartas do Destino por
// dia e 300 cristais gratuitos todo mês. A cobrança real é
// R$ 24,99 ÚNICO por 30 dias, com 4 cartas e 300 premium na
// ativação. Oferta anunciada vincula (CDC art. 30): o card
// agora não tem NENHUM número escrito à mão — tudo vem da
// getGalaxiaPlusStatus, a mesma fonte da cobrança. Sem
// resposta, mostra só "Ver detalhes": nunca um preço errado.
//
// O toque leva à GalaxiaPlusScreen, que explica as regras,
// em vez de ir direto aos pacotes.
//
// v6.0 — FASE 7: a loja virou índice.
//
// Antes era uma rolagem única com saldo + Galáxia Plus + 4
// pacotes + 8 boosts + 8 molduras. Longa demais para qualquer
// decisão de compra acontecer. Todo o conteúdo migrou:
//   pacotes e Galáxia Plus → CrystalPacksScreen
//   Mercado Cósmico        → BoostsScreen
//   molduras               → FramesShopScreen
//   badges                 → BadgesShopScreen
//
// RESPONSIVO: os cards de categoria quebram em duas colunas a
// partir de 380px de largura útil.
// ============================================

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { LinearGradient }   from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCoins }         from '../../../context/CoinsContext';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';
import { formatPrice, galaxiaPlusBenefitLines } from '../../premium/services/galaxiaPlusService';
import { useGalaxiaPlusStatus } from '../../premium/hooks/useGalaxiaPlusStatus';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type CategoryRoute = 'CrystalPacks' | 'Boosts' | 'FramesShop' | 'BadgesShop';



const CATEGORIES: {
  route:    CategoryRoute;
  icon:     string;
  title:    string;
  sub:      string;
  gradient: [string, string];
}[] = [
  { route: 'CrystalPacks', icon: '💎', title: 'Cristais', sub: 'Pacotes a partir de R$ 5', gradient: ['#2A1A4E', '#4E2B7E'] },
  { route: 'Boosts',       icon: '🚀', title: 'Impulsos', sub: 'Mais visibilidade agora',  gradient: ['#1A2A4E', '#2B4E7E'] },
  { route: 'FramesShop',   icon: '🖼️', title: 'Molduras', sub: '8 estilos · 30 dias',      gradient: ['#4E1A3A', '#7E2B5E'] },
  { route: 'BadgesShop',   icon: '✦',  title: 'Badges',   sub: 'Diga o que você procura',   gradient: ['#4E3A1A', '#7E5E2B'] },
];


export default function StoreScreen() {
  const navigation = useNavigation<NavProp>();
  const { wallet } = useCoins();
  const { width }  = useWindowDimensions();

  const galaxia = useGalaxiaPlusStatus();

  const coinsGratuitos = wallet?.coinsGratuitos ?? 0;
  const coinsPremium   = wallet?.coinsPremium   ?? 0;
  const fragments      = wallet?.fragments      ?? 0;

  // Duas colunas quando há espaço; uma só em telas estreitas.
  const cardWidth = width >= 380 ? '48%' : '100%';

  const galaxiaPrice = formatPrice(galaxia?.price);
  const galaxiaLine = galaxia?.active
    ? `Ativa · ${galaxia.daysLeft} ${galaxia.daysLeft === 1 ? 'dia restante' : 'dias restantes'}`
    : galaxia && galaxiaPrice
      ? `R$ ${galaxiaPrice} · ${galaxia.duration} dias`
      : 'Ver detalhes';

  return (
    <View style={styles.container}>
      <Header title="Loja" showBack={true} showHome={true} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Saldo */}
        <LinearGradient colors={['#1A0A2E', '#2D1B4E']} style={styles.balanceCard}>
          <Text style={styles.balanceTitle}>✨ SEU SALDO</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceValue}>{coinsGratuitos}</Text>
              <Text style={styles.balanceLabel}>GRATUITOS</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceStat}>
              <Text style={[styles.balanceValue, styles.balanceValuePremium]}>
                {coinsPremium}
              </Text>
              <Text style={styles.balanceLabel}>PREMIUM 💎</Text>
            </View>
          </View>
          {fragments > 0 && (
            <TouchableOpacity
              style={styles.fragmentsRow}
              onPress={() => navigation.navigate('Fragments')}
              activeOpacity={0.85}
            >
              <Text style={styles.fragmentsText}>
                🔮 {fragments} Fragmentos · = {Math.floor(fragments / 100)} cristais · converter ›
              </Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* Categorias */}
        <View style={styles.categoryGrid}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.route}
              style={[styles.categoryCard, { width: cardWidth }]}
              onPress={() => navigation.navigate(cat.route as any)}
              activeOpacity={0.85}
            >
              <LinearGradient colors={cat.gradient} style={styles.categoryInner}>
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={styles.categoryTitle}>{cat.title}</Text>
                <Text style={styles.categorySub}>{cat.sub}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Meus itens */}
        <View style={styles.myItemsRow}>
          <TouchableOpacity
            style={styles.myItemsBtn}
            onPress={() => navigation.navigate('Frames')}
          >
            <Text style={styles.myItemsText}>🖼️ Minhas molduras</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.myItemsBtn}
            onPress={() => navigation.navigate('Badges')}
          >
            <Text style={styles.myItemsText}>✦ Meus badges</Text>
          </TouchableOpacity>
        </View>

        {/* Galáxia Plus */}
        <Text style={styles.sectionTitle}>💜 Galáxia Plus</Text>
        <TouchableOpacity
          style={styles.galaxiaCard}
          onPress={() => navigation.navigate('GalaxiaPlus')}
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
              <Text style={styles.galaxiaArrow}>›</Text>
            </View>
            {galaxia && (
              <>
                <View style={styles.galaxiaBenefits}>
                  {galaxiaPlusBenefitLines(galaxia).map(line => (
                    <Text key={line} style={styles.galaxiaBenefit}>{line}</Text>
                  ))}
                </View>
                {!galaxia.active && (
                  <Text style={styles.galaxiaNote}>
                    Pagamento único por Pix · sem renovação automática
                  </Text>
                )}
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ Sobre os Cristais</Text>
          <Text style={styles.infoText}>• Gratuitos: ganhos por engajamento diário</Text>
          <Text style={styles.infoText}>• Premium: comprados, desbloqueiam recursos exclusivos</Text>
          <Text style={styles.infoText}>• Pagamento 100% seguro via PIX</Text>
          <Text style={styles.infoText}>• Cristais não expiram após a compra</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: COLORS.background },
  balanceCard:          { margin: S.md, borderRadius: R.xl, padding: S.xl, gap: S.md, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)' },
  balanceTitle:         { color: COLORS.secondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extrabold, textAlign: 'center', letterSpacing: 2 },
  balanceRow:           { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  balanceStat:          { alignItems: 'center', gap: 4 },
  balanceValue:         { color: COLORS.surface, fontSize: 40, fontWeight: FONT_WEIGHT.extrabold },
  balanceValuePremium:  { color: '#FFD700' },
  balanceLabel:         { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, letterSpacing: 1 },
  balanceDivider:       { width: 1, height: 40, backgroundColor: COLORS.border },
  fragmentsRow:         { backgroundColor: 'rgba(181,123,238,0.1)', borderRadius: R.full, padding: S.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.secondary + '44' },
  fragmentsText:        { color: COLORS.secondary, fontSize: FONT_SIZE.xs, textAlign: 'center' },
  categoryGrid:         { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginHorizontal: S.md },
  categoryCard:         { borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: S.sm },
  categoryInner:        { padding: S.lg, gap: 4, minHeight: 116, justifyContent: 'center' },
  categoryIcon:         { fontSize: 30 },
  categoryTitle:        { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extrabold },
  categorySub:          { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  myItemsRow:           { flexDirection: 'row', gap: S.sm, marginHorizontal: S.md, marginTop: S.xs },
  myItemsBtn:           { flex: 1, backgroundColor: COLORS.card, borderRadius: R.lg, paddingVertical: S.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  myItemsText:          { color: COLORS.secondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  sectionTitle:         { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginHorizontal: S.md, marginTop: S.lg, marginBottom: S.xs },
  galaxiaCard:          { marginHorizontal: S.md, borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.secondary + '66' },
  galaxiaInner:         { padding: S.lg, gap: S.md },
  galaxiaHeader:        { flexDirection: 'row', alignItems: 'center', gap: S.md },
  galaxiaIcon:          { fontSize: 36 },
  galaxiaInfo:          { flex: 1 },
  galaxiaTitle:         { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extrabold },
  galaxiaPrice:         { color: COLORS.secondary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  galaxiaArrow:         { color: COLORS.secondary, fontSize: 28, fontWeight: FONT_WEIGHT.bold },
  galaxiaBenefits:      { gap: S.xs },
  galaxiaBenefit:       { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, lineHeight: 20 },
  galaxiaNote:          { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontStyle: 'italic' },
  infoCard:             { marginHorizontal: S.md, marginTop: S.lg, backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.lg, gap: S.xs, borderWidth: 1, borderColor: COLORS.border },
  infoTitle:            { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, marginBottom: S.xs },
  infoText:             { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, lineHeight: 18 },
});
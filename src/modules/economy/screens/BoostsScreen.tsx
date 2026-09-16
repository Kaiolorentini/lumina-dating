// ============================================
// LUMINA — BOOSTS SCREEN v1.0
// src/modules/economy/screens/BoostsScreen.tsx
//
// FASE 7 — recorte do Mercado Cósmico do StoreScreen.
//
// Cada item tem uma ACTION, e ela existe para não cobrar por
// efeito inexistente:
//   TURBO / FERTILIZER / IMPULSO / DESTAQUE → CF própria que
//     debita E ativa. Usar spendCoins aqui cobraria sem ativar.
//   VISITORS → tela própria, com o número de visitas à vista
//   SPEND    → spendCoins (só debita; exige efeito implementado)
//   SOON     → sem efeito no backend, card bloqueado
// ============================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation }    from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth }          from '../../../context/AuthContext';
import { useCoins }         from '../../../context/CoinsContext';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';
import { SpendableFeature, isPremiumOnly } from '../services/walletService';
import { usePremiumTools }                 from '../../premium/hooks/usePremiumTools';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type BoostAction = 'TURBO' | 'FERTILIZER' | 'IMPULSO' | 'DESTAQUE' | 'VISITORS' | 'SPEND' | 'SOON';

const BOOSTS: {
  key: SpendableFeature; icon: string; label: string; sub: string;
  cost: number; action: BoostAction;
}[] = [
  { key: 'REVEAL_VISITORS',         icon: '👁️', label: 'Ver Visitantes',    sub: 'Descubra quem visitou seu perfil', cost: 50,  action: 'VISITORS' },
  { key: 'IMPULSO_PERFIL',          icon: '🚀', label: 'Impulso de Perfil', sub: 'Mais visibilidade por 30 min',     cost: 80,  action: 'IMPULSO' },
  { key: 'TURBO_SINTONIA',          icon: '⚡', label: 'Turbo Sintonia',    sub: 'Impulso 1.8× por 30 min',          cost: 120, action: 'TURBO' },
  { key: 'DESTAQUE_REGIONAL',       icon: '📍', label: 'Destaque Regional', sub: 'Destaque na sua região por 4h',    cost: 150, action: 'DESTAQUE' },
  { key: 'FERTILIZANTE_SINTONIA',   icon: '🌱', label: 'Fertilizante',      sub: '+50% XP da Árvore por 24h',        cost: 80,  action: 'FERTILIZER' },
  { key: 'REVEAL_QUASE_SINTONIA',   icon: '💜', label: 'Quase Sintonia',    sub: 'Revele quem quase deu match',      cost: 25,  action: 'SOON' },
  { key: 'SEGUNDA_CHANCE',          icon: '🔄', label: 'Segunda Chance',    sub: 'Reveja um perfil descartado',      cost: 15,  action: 'SOON' },
  { key: 'REVEAL_SINTONIA_PERDIDA', icon: '💔', label: 'Sintonia Perdida',  sub: 'Recupere uma conexão perdida',     cost: 35,  action: 'SOON' },
];

export default function BoostsScreen() {
  const navigation        = useNavigation<NavProp>();
  const { user }          = useAuth();
  const { wallet, spend } = useCoins();

  const coinsGratuitos = wallet?.coinsGratuitos ?? 0;
  const coinsPremium   = wallet?.coinsPremium   ?? 0;

  const [spending, setSpending] = useState<string | null>(null);

  const {
    fertilizer, turbo, impulso, destaque, activating,
    activateFertilizer, activateTurbo, activateImpulso, activateDestaqueRegional,
  } = usePremiumTools(user?.uid);

  async function handleBoost(item: typeof BOOSTS[number]) {
    if (!user?.uid || spending || activating) return;

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
                Alert.alert('Não foi possível ativar', res.error);
              }
            },
          },
        ]);
      return;
    }

    // action === 'SPEND'
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
      <Header title="Impulsos" showBack={true} showHome={true} />
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.balanceStrip}>
          <Text style={styles.balanceStripText}>
            <Text style={styles.balanceFree}>✨ {coinsGratuitos}</Text>
            {'   ·   '}
            <Text style={styles.balancePremium}>💎 {coinsPremium}</Text>
          </Text>
        </View>

        <Text style={styles.sectionSub}>
          💎 = exige Cristais Premium exclusivamente
        </Text>

        <View style={styles.list}>
          {BOOSTS.map(item => {
            const premiumOnly = isPremiumOnly(item.key);
            const isSoon      = item.action === 'SOON';
            const isBusy      = spending === item.key
              || (item.action === 'TURBO'      && activating === 'TURBO')
              || (item.action === 'FERTILIZER' && activating === 'FERTILIZER')
              || (item.action === 'IMPULSO'    && activating === 'IMPULSO')
              || (item.action === 'DESTAQUE'   && activating === 'DESTAQUE');
            const isActive    = (item.action === 'TURBO'      && turbo?.status      === 'ACTIVE')
              || (item.action === 'FERTILIZER' && fertilizer?.status === 'ACTIVE')
              || (item.action === 'IMPULSO'    && impulso?.status    === 'ACTIVE')
              || (item.action === 'DESTAQUE'   && destaque?.status   === 'ACTIVE');
            const canAfford   = premiumOnly
              ? coinsPremium >= item.cost
              : (coinsGratuitos + coinsPremium) >= item.cost;

            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.card,
                  premiumOnly && styles.cardPremium,
                  (!canAfford || isSoon) && styles.cardLocked,
                  isActive && styles.cardActive,
                ]}
                onPress={() => handleBoost(item)}
                disabled={isBusy}
                activeOpacity={0.85}
              >
                <Text style={styles.icon}>{item.icon}</Text>
                <View style={styles.info}>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.sub}>{isActive ? 'Ativo agora ✓' : item.sub}</Text>
                </View>
                {isBusy ? (
                  <ActivityIndicator color={COLORS.secondary} />
                ) : isSoon ? (
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonBadgeText}>Em breve</Text>
                  </View>
                ) : isActive ? (
                  <Text style={styles.activeText}>ATIVO</Text>
                ) : (
                  <Text style={[styles.cost, premiumOnly && styles.costPremium]}>
                    {premiumOnly ? '💎' : '✨'} {item.cost}
                  </Text>
                )}
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
  container:          { flex: 1, backgroundColor: COLORS.background },
  balanceStrip:       { marginHorizontal: S.md, marginTop: S.md, backgroundColor: COLORS.card, borderRadius: R.full, paddingVertical: S.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  balanceStripText:   { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  balanceFree:        { color: '#B57BEE' },
  balancePremium:     { color: '#FFD700' },
  sectionSub:         { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginHorizontal: S.md, marginTop: S.md, marginBottom: S.sm },
  list:               { marginHorizontal: S.md, gap: S.sm },
  card:               { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: R.lg, padding: S.md, gap: S.md, borderWidth: 1, borderColor: COLORS.border },
  cardPremium:        { borderColor: '#FFD70055', backgroundColor: 'rgba(255,215,0,0.04)' },
  cardLocked:         { opacity: 0.45 },
  cardActive:         { borderColor: '#44FF88', backgroundColor: 'rgba(68,255,136,0.06)' },
  icon:               { fontSize: 26 },
  info:               { flex: 1 },
  label:              { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  sub:                { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  cost:               { color: COLORS.secondary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extrabold },
  costPremium:        { color: '#FFD700' },
  activeText:         { color: '#44FF88', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extrabold, letterSpacing: 1 },
  soonBadge:          { backgroundColor: COLORS.border, borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 2 },
  soonBadgeText:      { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
});
// ============================================
// LUMINA — GALÁXIA PLUS
// src/modules/premium/screens/GalaxiaPlusScreen.tsx
//
// Duas telas numa: bloqueada para quem não assina, com o
// cadeado e o que está perdendo; aberta para quem assina, com
// o prazo e o CONSUMO de cada benefício.
//
// ── POR QUE MOSTRAR O CONSUMO ──
//
// "Você tem 20% de bônus na Faísca" é promessa. "Esse bônus já
// te deu 34 cristais" é fato. A renovação se decide olhando o
// que a assinatura entregou, não o que ela promete.
//
// ── ATALHOS PARA USAR ──
//
// Benefício pago que a pessoa não sabe onde usar é benefício
// que não existe. Cada linha ativa leva direto à tela onde ele
// é gasto — e só aparece quando há o que usar.
//
// ── ESTADO DE ERRO ──
//
// Sem ele, uma falha da CF mostrava a tela bloqueada com
// números vazios e "Ativar por R$ undefined". Se já havia
// dados carregados, eles continuam na tela.
//
// ── ACESSO DE 30 DIAS, NÃO ASSINATURA ──
//
// Nada é cobrado automaticamente. Quando expira, os benefícios
// param — mas os cristais, fragmentos, Turbos e o badge ficam.
// A tela diz isso em todos os estados, para ninguém se sentir
// enganado.
// ============================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import {
  fetchGalaxiaPlusStatus, formatPrice, GalaxiaPlusStatus,
} from '../services/galaxiaPlusService';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../context/AuthContext';
import Header from '../../../components/Header';
import { Badge } from '../../../components/profile/Badge';
import { badgeAppearanceById } from '../../../config/cosmeticsCatalog';
import { CrystalFieldBackground } from '../../../components/CrystalFieldBackground';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface Status {
  active:         boolean;
  expiresAt:      string | null;
  daysLeft:       number;
  everSubscribed: boolean;
  totalRenewals:  number;
  price:          number;
  duration:       number;
  grants: {
    crystals: number;
    turbos:   number;
    badge:    string;
    renewalFragments: number;
  };
  benefits: {
    destinyCards: { perDay: number; usedToday: number; left: number; totalDrawn: number };
    turbos:       { granted: number; used: number; available: number };
    faisca:       { bonusPercent: number; crystalsEarned: number };
    visitors:     { normalCost: number; timesRevealed: number; crystalsSaved: number };
    vault:        { instantWithdraws: number; crystalsFromInstant: number };
  };
}

interface BenefitAction {
  label:   string;
  onPress: () => void;
}

export default function GalaxiaPlusScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();

  const [status,  setStatus]  = useState<GalaxiaPlusStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setError(false);
    try {
      setStatus(await fetchGalaxiaPlusStatus());
    } catch (err) {
      console.error('[GalaxiaPlus] load:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // Recarrega ao voltar da loja: a pessoa pode ter acabado de
  // comprar, e a tela precisa refletir isso.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function retry() {
    setLoading(true);
    load();
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <CrystalFieldBackground />
        <Header title="Galáxia Plus" showBack showHome />
        <View style={styles.center}>
          <ActivityIndicator color="#B57BEE" size="large" />
        </View>
      </View>
    );
  }

  // Sem dados para mostrar. Com dados de uma carga anterior, a
  // falha ao voltar à tela não esconde o que já estava certo.
  if (!status) {
    return (
      <View style={styles.container}>
        <CrystalFieldBackground />
        <Header title="Galáxia Plus" showBack showHome />
        <View style={styles.center}>
          <Text style={styles.errorIcon}>🌌</Text>
          <Text style={styles.errorTitle}>
            {error ? 'Não foi possível carregar' : 'Entre na sua conta'}
          </Text>
          <Text style={styles.errorText}>
            {error
              ? 'Verifique sua conexão e tente de novo.'
              : 'É preciso estar logado para ver a Galáxia Plus.'}
          </Text>
          {error && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={retry}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar de novo"
            >
              <Text style={styles.retryText}>Tentar de novo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const active = status.active;
  const b      = status.benefits;
  const price  = formatPrice(status.price);

  return (
    <View style={styles.container}>
      <CrystalFieldBackground />
      <Header title="Galáxia Plus" showBack showHome />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── CABEÇALHO ── */}
        <LinearGradient
          colors={active ? ['#2A0A4E', '#4E1B7E'] : ['#1A1A22', '#24242E']}
          style={[styles.hero, active && styles.heroActive]}
        >
          {active ? (
            <>
              <Text style={styles.heroIcon}>💜</Text>
              <Text style={styles.heroTitle}>Galáxia Plus ativa</Text>
              <View style={styles.daysBox}>
                <Text style={styles.daysNumber}>{status.daysLeft}</Text>
                <Text style={styles.daysLabel}>
                  {status.daysLeft === 1 ? 'dia restante' : 'dias restantes'}
                </Text>
              </View>
              {status.totalRenewals > 1 ? (
                <Text style={styles.heroNote}>
                  {status.totalRenewals}ª vez com a gente 💜
                </Text>
              ) : null}
            </>
          ) : (
            <>
              {/* O cadeado é o que diz, sem texto, que há algo
                  atrás desta tela. */}
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.heroTitleLocked}>
                {status.everSubscribed ? 'Seu acesso expirou' : 'Galáxia Plus'}
              </Text>
              <Text style={styles.heroSubLocked}>
                {status.everSubscribed
                  ? 'Os benefícios pararam, mas tudo que você recebeu continua seu.'
                  : `${status.duration ?? 30} dias de acesso por R$ ${price ?? '24,99'}`}
              </Text>
            </>
          )}
        </LinearGradient>

        {/* ── O QUE A ATIVAÇÃO ENTREGA ── */}
        {!active && (
          <>
            <Text style={styles.sectionTitle}>Ao ativar, você recebe na hora</Text>
            <View style={styles.grantsRow}>
              <View style={styles.grantBox}>
                <Text style={styles.grantValue}>{status.grants.crystals}</Text>
                <Text style={styles.grantLabel}>cristais{'\n'}premium</Text>
              </View>
              <View style={styles.grantBox}>
                <Text style={styles.grantValue}>{status.grants.turbos}</Text>
                <Text style={styles.grantLabel}>Turbos{'\n'}Sintonia</Text>
              </View>
              <View style={styles.grantBox}>
                <View style={styles.grantBadge}>
                  <Badge
                    appearance={badgeAppearanceById('badge_constelacao_guia', 'MYTHIC')!}
                    size={44}
                  />
                </View>
                <Text style={styles.grantLabel}>badge{'\n'}exclusivo</Text>
              </View>
            </View>
          </>
        )}

        {/* ── BENEFÍCIOS ── */}
        <Text style={styles.sectionTitle}>
          {active ? 'Seus benefícios' : 'E durante os 30 dias'}
        </Text>

        <BenefitRow
          icon="🃏"
          title="Cartas do Destino"
          locked={!active}
          summary={active
            ? `${b.destinyCards.left} de ${b.destinyCards.perDay} hoje`
            : `${b.destinyCards.perDay ?? 4} por dia, todas grátis`}
          detail={active && b.destinyCards.totalDrawn > 0
            ? `${b.destinyCards.totalDrawn} cartas abertas desde que você assinou`
            : 'Sem a assinatura é 1 grátis e 3 pagas por dia'}
          action={active && b.destinyCards.left > 0
            ? { label: 'Abrir', onPress: () => navigation.navigate('DestinyCard') }
            : undefined}
        />

        <BenefitRow
          icon="⚡"
          title="Turbos Sintonia"
          locked={!active}
          summary={active
            ? `${b.turbos.available} disponíveis`
            : '4 na ativação'}
          detail={active
            ? `${b.turbos.used} de ${b.turbos.granted} usados`
            : 'Cada um vale 120 cristais premium'}
          action={active && b.turbos.available > 0
            ? { label: 'Usar', onPress: () => navigation.navigate('PremiumTools') }
            : undefined}
        />

        <BenefitRow
          icon="✨"
          title="Faísca turbinada"
          locked={!active}
          summary={`+${b.faisca.bonusPercent ?? 20}% em todo resgate`}
          detail={active && b.faisca.crystalsEarned > 0
            ? `Já te rendeu ${b.faisca.crystalsEarned} cristais a mais`
            : 'O bônus entra em cada Faísca do dia'}
          action={active
            ? { label: 'Abrir', onPress: () => navigation.navigate('Faisca') }
            : undefined}
        />

        <BenefitRow
          icon="👀"
          title="Ver quem visitou"
          locked={!active}
          summary="Sem gastar cristais"
          detail={active && b.visitors.crystalsSaved > 0
            ? `${b.visitors.timesRevealed} revelações · ${b.visitors.crystalsSaved} cristais economizados`
            : `Normalmente custa ${b.visitors.normalCost ?? 50} cristais cada vez`}
          action={active
            ? { label: 'Ver', onPress: () => navigation.navigate('Visitors') }
            : undefined}
        />

        <BenefitRow
          icon="🗝️"
          title="Saque imediato do Cofre"
          locked={!active}
          summary="Sem as 48 horas de espera"
          detail={active && b.vault.instantWithdraws > 0
            ? `${b.vault.instantWithdraws} saques sem espera · ${b.vault.crystalsFromInstant} cristais`
            : 'Fragmentos viram cristais na hora'}
          action={active
            ? { label: 'Abrir', onPress: () => navigation.navigate('Vault') }
            : undefined}
        />

        {/* ── AÇÃO ── */}
        <TouchableOpacity
          style={[styles.cta, active && styles.ctaRenew]}
          onPress={() => navigation.navigate('CrystalPacks')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={active ? `Renovar por ${price} reais` : `Ativar por ${price} reais`}
        >
          <Text style={[styles.ctaText, active && styles.ctaTextRenew]}>
            {active ? `Renovar por R$ ${price}` : `Ativar por R$ ${price}`}
          </Text>
        </TouchableOpacity>

        {/* ── AS REGRAS, SEM LETRA MIÚDA ── */}
        <View style={styles.rules}>
          <Text style={styles.rulesTitle}>Como funciona</Text>
          <Text style={styles.rulesText}>
            • Pagamento único por Pix. <Text style={styles.rulesStrong}>Nada é cobrado
            automaticamente</Text> — quando os {status.duration ?? 30} dias acabam, acaba.
          </Text>
          <Text style={styles.rulesText}>
            • Renovar antes de expirar <Text style={styles.rulesStrong}>soma</Text> os
            dias: você não perde o que sobrou.
          </Text>
          <Text style={styles.rulesText}>
            • Ao expirar, os cristais, fragmentos, Turbos e o badge
            que você recebeu <Text style={styles.rulesStrong}>continuam seus para
            sempre</Text>. Só os benefícios contínuos param.
          </Text>
          <Text style={styles.rulesText}>
            • O badge Constelação Guia vem na primeira ativação. Nas
            renovações você recebe {status.grants.renewalFragments ?? 20} fragmentos
            no lugar, já que o badge já é seu.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function BenefitRow({
  icon, title, summary, detail, locked, action,
}: {
  icon: string; title: string; summary: string; detail: string | false; locked: boolean;
  /** Atalho para onde o benefício é usado. Só com assinatura ativa. */
  action?: BenefitAction;
}) {
  return (
    <View style={[styles.benefit, locked && styles.benefitLocked]}>
      <Text style={styles.benefitIcon}>{locked ? '🔒' : icon}</Text>
      <View style={styles.benefitInfo}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={[styles.benefitSummary, !locked && styles.benefitSummaryActive]}>
          {summary}
        </Text>
        {detail ? <Text style={styles.benefitDetail}>{detail}</Text> : null}
      </View>
      {action && !locked ? (
        <TouchableOpacity
          style={styles.benefitAction}
          onPress={action.onPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${action.label}: ${title}`}
        >
          <Text style={styles.benefitActionText}>{action.label} ›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  scroll:    { paddingBottom: spacing.xl },

  errorIcon:   { fontSize: 44, opacity: 0.8 },
  errorTitle:  { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center' },
  errorText:   { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center', lineHeight: 20 },
  retryButton: { marginTop: spacing.md, borderWidth: 1, borderColor: '#B57BEE', borderRadius: borderRadius.full, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  retryText:   { color: '#B57BEE', fontSize: fonts.sizes.md, fontWeight: 'bold' },

  hero: {
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  heroActive:      { borderColor: '#B57BEE' },
  heroIcon:        { fontSize: 44 },
  lockIcon:        { fontSize: 40, opacity: 0.7 },
  heroTitle:       { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  heroTitleLocked: { color: colors.grayLight, fontSize: fonts.sizes.xl, fontWeight: 'bold', marginTop: spacing.xs },
  heroSubLocked:   { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.md },
  heroNote:        { color: '#B57BEE', fontSize: fonts.sizes.sm, marginTop: spacing.xs },
  daysBox:         { alignItems: 'center', marginTop: spacing.sm },
  daysNumber:      { color: '#FFD700', fontSize: 52, fontWeight: 'bold', lineHeight: 58 },
  daysLabel:       { color: colors.grayLight, fontSize: fonts.sizes.sm },

  sectionTitle: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  grantsRow:  { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.md },
  grantBox:   { flex: 1, alignItems: 'center', gap: 4, backgroundColor: colors.surface + 'F2', borderRadius: borderRadius.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: '#B57BEE44' },
  grantValue: { color: '#FFD700', fontSize: fonts.sizes.xxl, fontWeight: 'bold' },
  grantBadge: { height: 46, justifyContent: 'center' },
  grantLabel: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center', lineHeight: 14 },

  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface + 'F2',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#B57BEE33',
  },
  benefitLocked:        { borderColor: colors.grayDark, opacity: 0.72 },
  benefitIcon:          { fontSize: 26, width: 34, textAlign: 'center' },
  benefitInfo:          { flex: 1, gap: 2 },
  benefitTitle:         { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  benefitSummary:       { color: colors.gray, fontSize: fonts.sizes.sm },
  benefitSummaryActive: { color: '#B57BEE', fontWeight: 'bold' },
  benefitDetail:        { color: colors.gray, fontSize: fonts.sizes.xs, lineHeight: 16, marginTop: 2 },
  benefitAction: {
    borderWidth: 1,
    borderColor: '#B57BEE',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  benefitActionText: { color: '#B57BEE', fontSize: fonts.sizes.xs, fontWeight: 'bold' },

  cta: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: '#B57BEE',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaRenew:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#B57BEE' },
  ctaText:      { color: colors.background, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  ctaTextRenew: { color: '#B57BEE' },

  rules: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface + 'F2',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
    gap: spacing.sm,
  },
  rulesTitle:  { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold', marginBottom: 2 },
  rulesText:   { color: colors.gray, fontSize: fonts.sizes.xs, lineHeight: 18 },
  rulesStrong: { color: colors.grayLight, fontWeight: 'bold' },
});
// ============================================
// LUMINA — CARTA DO DESTINO
// src/modules/engagement/screens/DestinyCardScreen.tsx
//
// Duas pessoas, uma escolha por dia. A escolha CRIA A CONEXÃO
// e libera a conversa — é isso que separa a Carta da aba
// Sintonize, que é aleatória e não dá privilégio nenhum.
//
// Uma grátis, mais três pagas em cristais PREMIUM: 50, 70 e
// 90 — sobe a cada troca. Quem escolhe encerra o dia.
//
// Premium e não gratuitos nem fragmentos: a Carta entrega uma
// conexão garantida, o bem mais valioso do app. Sem saldo, o
// caminho é a loja.
//
// ── ORIENTAÇÃO ──
//
// Cada passo diz o que fazer e o que vai acontecer. Kaio
// pediu explícito: a pessoa não pode gastar cristais sem
// entender, nem escolher sem saber que encerra o dia.
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../context/AuthContext';
import { useCoins } from '../../../context/CoinsContext';
import { getProfile } from '../../profile/services/profileService';
import { getUserProfile } from '../../../services/usersService';
import { calcularSintonia } from '../../../utils/sintoniaEngine';
import Header from '../../../components/Header';
import { DestinyBackground } from '../components/DestinyBackground';
import { DestinyCardFlip } from '../components/DestinyCardFlip';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Genéricos em tipos nomeados: httpsCallable< em fim de linha
// é corrompido ao colar.
interface DestinyProfile {
  uid:      string;
  name:     string;
  age:      number;
  photoURL: string;
  city:     string;
  sintonia: number;
}

interface CardState {
  profiles:  DestinyProfile[];
  drawsUsed: number;
  maxDraws:  number;
  freeDraws: number;
  /** Preço da PRÓXIMA troca em cristais premium: 50, 70, 90. */
  nextPrice: number;
  chosenUid: string | null;
}

interface DrawResult {
  profiles:  DestinyProfile[];
  drawsUsed: number;
  maxDraws:  number;
  nextPrice: number;
  wasPaid:   boolean;
}

interface ChoosePayload {
  targetUid: string;
}

export default function DestinyCardScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();
  const { wallet, refreshWallet } = useCoins();

  const [state,    setState]    = useState<CardState | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [drawing,  setDrawing]  = useState(false);
  const [choosing, setChoosing] = useState<string | null>(null);
  // Muda a cada sorteio para a carta voltar a ficar fechada:
  // quem paga por outra tem direito ao mesmo momento de virar.
  const [cardKey,  setCardKey]  = useState(0);
  const [revealed, setRevealed] = useState(false);
  /**
   * Sintonia recalculada no CLIENTE, por uid.
   *
   * O servidor usa um cálculo simplificado — preferência,
   * idade e região — só para ESCOLHER quem mostrar. Mas o
   * número exibido tem que ser o mesmo que a pessoa vê no
   * perfil aberto e no card do feed, senão a carta diz 78% e
   * o perfil diz 64%.
   *
   * Portar o calcularSintonia inteiro para o backend
   * duplicaria ~100 linhas, e o projeto já sofreu com
   * catálogos duplicados divergindo.
   */
  const [localScores, setLocalScores] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    try {
      const fn = httpsCallable<void, CardState>(getFunctions(), 'getDestinyCard');
      const res = await fn();
      setState(res.data);
      // Carta já sorteada hoje volta aberta: virar de novo o
      // que já foi revelado seria teatro vazio.
      setRevealed(res.data.profiles.length > 0);
    } catch (error) {
      console.error('[DestinyCard] load:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Recalcula quando os perfis mudam. Duas leituras por
  // pessoa mostrada — aceitável, porque são no máximo duas
  // por carta e a carta é rara.
  useEffect(() => {
    async function recalc() {
      if (!user?.uid || !state?.profiles.length) return;

      const me = await getProfile(user.uid);
      if (!me) return;

      const scores: Record<string, number> = {};

      await Promise.all(state.profiles.map(async p => {
        const other = await getUserProfile(p.uid);
        if (!other) return;
        scores[p.uid] = calcularSintonia(me, other).score;
      }));

      setLocalScores(prev => ({ ...prev, ...scores }));
    }

    recalc().catch(() => { /* fica o número do servidor */ });
  }, [user?.uid, state?.profiles]);

  // Volta do perfil de alguém: recarrega, porque a pessoa
  // pode ter escolhido por lá ou o estado pode ter mudado.
  useFocusEffect(
    useCallback(() => {
      if (!loading) load();
    }, [loading, load]),
  );

   // Só PREMIUM: os cristais gratuitos ficam para as
  // revelações, e os fragmentos para o Cofre e os badges.
  const premium = wallet?.coinsPremium ?? 0;

  async function doDraw() {
    if (drawing || !state) return;

    const isPaid = state.drawsUsed >= state.freeDraws;

    if (isPaid && premium < state.nextPrice) {
      Alert.alert(
        'Cristais premium insuficientes',
        `Ver outras duas custa ${state.nextPrice} cristais premium, e você tem ${premium}.\n\nCristais premium vêm da loja — os gratuitos não valem para a Carta.`,
        [
          { text: 'Agora não', style: 'cancel' },
          {
            text: 'Ir para a loja',
            onPress: () => navigation.navigate('CrystalPacks'),
          },
        ],
      );
      return;
    }

    if (isPaid) {
      const restantes = state.maxDraws - state.drawsUsed - 1;
      const aviso = restantes > 0
        ? `Custa ${state.nextPrice} cristais premium. As pessoas de agora não voltam, e você ainda terá ${restantes} ${restantes === 1 ? 'troca' : 'trocas'} depois desta.`
        : `Custa ${state.nextPrice} cristais premium. As pessoas de agora não voltam, e esta é sua última troca de hoje.`;

      const confirmed = await confirm('Ver outras duas pessoas', aviso);
      if (!confirmed) return;
    }

    setDrawing(true);
    try {
      const fn = httpsCallable<void, DrawResult>(getFunctions(), 'drawDestinyCard');
      const res = await fn();

      setState(prev => prev ? {
        ...prev,
        profiles:  res.data.profiles,
        drawsUsed: res.data.drawsUsed,
        nextPrice: res.data.nextPrice,
      } : null);

      setRevealed(false);
      setCardKey(k => k + 1);
      if (res.data.wasPaid) refreshWallet();
    } catch (error) {
      const message = (error as { message?: string })?.message
        ?? 'Não foi possível abrir a carta.';
      Alert.alert('Carta do Destino', message);
    } finally {
      setDrawing(false);
    }
  }

  async function doChoose(profile: DestinyProfile) {
    if (choosing) return;

    const confirmed = await confirm(
      `Escolher ${profile.name}?`,
      'Vocês poderão conversar a partir de agora. Esta é sua escolha de hoje — amanhã a carta traz novas pessoas.',
    );
    if (!confirmed) return;

    setChoosing(profile.uid);
    try {
      const fn = httpsCallable<ChoosePayload, { success: boolean }>(
        getFunctions(), 'chooseDestinyProfile',
      );
      await fn({ targetUid: profile.uid });

      setState(prev => prev ? { ...prev, chosenUid: profile.uid } : null);

      Alert.alert(
        '✦ Conexão criada',
        `Você já pode conversar com ${profile.name}.`,
        [
          { text: 'Depois', style: 'cancel' },
          {
            text: 'Conversar agora',
            onPress: () => navigation.navigate('UserChat', {
              userId:    profile.uid,
              userName:  profile.name,
              userPhoto: profile.photoURL,
            }),
          },
        ],
      );
    } catch (error) {
      const message = (error as { message?: string })?.message
        ?? 'Não foi possível concluir a escolha.';
      Alert.alert('Carta do Destino', message);
    } finally {
      setChoosing(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <DestinyBackground />
        <Header title="Carta do Destino" showBack showHome />
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </View>
    );
  }

  const drawsLeft = state ? state.maxDraws - state.drawsUsed : 0;
  const nextIsPaid = state ? state.drawsUsed >= state.freeDraws : false;
  const chosen = state?.chosenUid
    ? state.profiles.find(p => p.uid === state.chosenUid)
    : null;

  return (
    <View style={styles.container}>
      <DestinyBackground />
      <Header title="Carta do Destino" showBack showHome />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── JÁ ESCOLHEU ── */}
        {chosen ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneIcon}>✦</Text>
            <Text style={styles.doneTitle}>Sua escolha de hoje</Text>

            <TouchableOpacity
              style={styles.chosenCard}
              onPress={() => navigation.navigate('RealProfile', { userId: chosen.uid })}
              activeOpacity={0.85}
            >
              <Image source={{ uri: chosen.photoURL }} style={styles.chosenPhoto} />
              <View style={styles.chosenInfo}>
                <Text style={styles.chosenName}>{chosen.name}, {chosen.age}</Text>
                <Text style={styles.chosenCity}>📍 {chosen.city}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('UserChat', {
                userId:    chosen.uid,
                userName:  chosen.name,
                userPhoto: chosen.photoURL,
              })}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryText}>💬 Conversar</Text>
            </TouchableOpacity>

            <Text style={styles.doneHint}>
              Amanhã a carta traz novas pessoas. Enquanto isso,
              a aba Sintonize continua aberta.
            </Text>
          </View>
        ) : state && state.profiles.length === 0 ? (
          /* ── NENHUMA CARTA ABERTA HOJE ── */
          <>
            <Text style={styles.intro}>
              Todo dia o Lumina procura, entre todas as pessoas,
              as duas mais compatíveis com você.
            </Text>

            <TouchableOpacity
              style={styles.openButton}
              onPress={doDraw}
              disabled={drawing}
              activeOpacity={0.85}
            >
              {drawing
                ? <ActivityIndicator color={colors.background} />
                : <Text style={styles.openButtonText}>Abrir a carta de hoje</Text>
              }
            </TouchableOpacity>

            <Text style={styles.introSmall}>
              A primeira carta do dia é grátis.
            </Text>
          </>
        ) : (
          /* ── CARTA ABERTA ── */
          <>
            <DestinyCardFlip
              resetKey={cardKey}
              disabled={drawing}
              onOpened={() => setRevealed(true)}
            >
              <ScrollView contentContainerStyle={styles.cardInner}>
                {/* Nem sempre há duas: numa base pequena ou
                    com preferência restrita, pode sobrar uma
                    só. O texto acompanha em vez de prometer
                    o que não está lá. */}
                <Text style={styles.cardTitle}>
                  {(state?.profiles.length ?? 0) > 1 ? 'Duas pessoas' : 'Uma pessoa'}
                </Text>
                <Text style={styles.cardSub}>
                  {(state?.profiles.length ?? 0) > 1
                    ? 'Escolha uma para conversar'
                    : 'Escolha para conversar'}
                </Text>

                <View style={styles.pair}>
                  {state?.profiles.map(p => (
                    <View key={p.uid} style={styles.personBox}>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('RealProfile', { userId: p.uid })}
                        activeOpacity={0.85}
                      >
                        <Image source={{ uri: p.photoURL }} style={styles.personPhoto} />
                        <View style={styles.matchTag}>
                          <Text style={styles.matchTagText}>
                            {localScores[p.uid] ?? p.sintonia}%
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <Text style={styles.personName} numberOfLines={1}>
                        {p.name}, {p.age}
                      </Text>
                      <Text style={styles.personCity} numberOfLines={1}>{p.city}</Text>

                      {/* Ver o perfil antes de decidir: a
                          escolha é definitiva no dia, então a
                          pessoa precisa poder olhar com calma
                          e voltar. */}
                      <TouchableOpacity
                        style={styles.peekButton}
                        onPress={() => navigation.navigate('RealProfile', { userId: p.uid })}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.peekText}>Ver perfil</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.chooseButton}
                        onPress={() => doChoose(p)}
                        disabled={choosing !== null}
                        activeOpacity={0.85}
                      >
                        {choosing === p.uid
                          ? <ActivityIndicator color={colors.background} size="small" />
                          : <Text style={styles.chooseText}>Escolher</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </DestinyCardFlip>

            {/* Explicação e troca — só depois de revelar, para
                não competir com o momento da virada. */}
            {revealed && (
              <View style={styles.footer}>
                <Text style={styles.footerRule}>
                  Escolher uma libera a conversa entre vocês — e
                  encerra sua carta de hoje.
                </Text>

                {drawsLeft > 0 ? (
                  <>
                    <TouchableOpacity
                      style={styles.swapButton}
                      onPress={doDraw}
                      disabled={drawing}
                      activeOpacity={0.85}
                    >
                      {drawing ? (
                        <ActivityIndicator color={colors.gold} size="small" />
                      ) : (
                        <Text style={styles.swapText}>
                          {nextIsPaid
                            ? `Ver outras duas · ${state?.nextPrice} 💎`
                            : 'Ver outras duas'}
                        </Text>
                      )}
                    </TouchableOpacity>

                    <Text style={styles.footerHint}>
                      {drawsLeft === 1
                        ? 'Esta é sua última troca de hoje.'
                        : `Você ainda tem ${drawsLeft} trocas hoje.`}
                      {nextIsPaid ? `\nSeus cristais premium: ${premium} 💎` : ''}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.footerHint}>
                    Você já viu todas as cartas de hoje. Escolha
                    uma das duas ou volte amanhã.
                  </Text>
                )}
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

/** Confirmação que funciona no Android, no iOS e na web. */
function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve((window as unknown as { confirm: (m: string) => boolean })
      .confirm(`${title}\n\n${message}`));
  }

  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirmar', onPress: () => resolve(true) },
    ]);
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { paddingTop: spacing.lg, paddingHorizontal: spacing.lg, alignItems: 'center' },

  intro: {
    color: colors.grayLight,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: spacing.xl * 2,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  introSmall: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  openButton: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minWidth: 220,
    alignItems: 'center',
  },
  openButtonText: {
    color: colors.background,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // Interior da carta
  cardInner:  { padding: spacing.lg, alignItems: 'center', gap: spacing.xs },
  cardTitle:  { color: colors.gold, fontSize: fonts.sizes.lg, fontWeight: 'bold', letterSpacing: 1 },
  cardSub:    { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.md },
  pair:       { flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
  personBox:  { flex: 1, alignItems: 'center', gap: 4 },
  personPhoto: {
    width: 118, height: 148,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold + '55',
    backgroundColor: colors.grayDark,
  },
  matchTag: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.background + 'DD',
    borderRadius: borderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  matchTagText: { color: colors.gold, fontSize: 10, fontWeight: 'bold' },
  personName: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold', marginTop: 6 },
  personCity: { color: colors.gray, fontSize: fonts.sizes.xs, marginBottom: 6 },
  peekButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  peekText: { color: colors.grayLight, fontSize: fonts.sizes.xs },
  chooseButton: {
    marginTop: 6,
    backgroundColor: colors.gold,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    minWidth: 96,
    alignItems: 'center',
  },
  chooseText: { color: colors.background, fontSize: fonts.sizes.sm, fontWeight: 'bold' },

  // Rodapé
  footer:     { marginTop: spacing.lg, alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  footerRule: { color: colors.grayLight, fontSize: fonts.sizes.sm, textAlign: 'center', lineHeight: 20 },
  swapButton: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gold + '66',
    backgroundColor: colors.gold + '12',
    minWidth: 220,
    alignItems: 'center',
  },
  swapText:   { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  footerHint: { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center', lineHeight: 17 },

  // Já escolheu
  doneBox:    { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, paddingHorizontal: spacing.md },
  doneIcon:   { fontSize: 44, color: colors.gold },
  doneTitle:  { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  chosenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    alignSelf: 'stretch',
  },
  chosenPhoto: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: colors.gold },
  chosenInfo:  { flex: 1, gap: 2 },
  chosenName:  { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  chosenCity:  { color: colors.gray, fontSize: fonts.sizes.sm },
  primaryButton: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  primaryText: { color: colors.background, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  doneHint:    { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center', lineHeight: 20 },
});
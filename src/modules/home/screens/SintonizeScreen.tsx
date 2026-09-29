// ============================================
// LUMINA — SINTONIZE
// src/modules/home/screens/SintonizeScreen.tsx
//
// Um perfil por vez, para DECIDIR. A grade da Home é para
// varrer; aqui a pessoa olha, escolhe, e segue.
//
// ── DIFERENÇAS DA GRADE ──
//
// A aura ANIMA aqui: um card por tela, o custo cabe. Na grade
// ela fica estática porque vários ficam visíveis ao mesmo
// tempo.
//
// Passar sem curtir DESCARTA por 24h. Curtir também avança.
//
// ── A FILA ──
//
// Busca 20 e mostra os que sobram depois de tirar descartados
// e incompletos. Quando restam 3, busca mais em segundo plano
// — a pessoa nunca vê carregamento entre um card e outro.
// ============================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions,
  TouchableOpacity, ActivityIndicator, Alert,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../../context/AuthContext';
import { getProfile } from '../../profile/services/profileService';
import { UserProfile, ProfileCardData } from '../../../shared/types';
import { RealProfile } from '../../../services/usersService';
import {
  fetchSintonizePage, activeDismissalMap, REFILL_THRESHOLD,
  fetchDismissedProfiles, bringBackProfile, DismissedProfile,
} from '../../../services/sintonizeService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCoins } from '../../../context/CoinsContext';
import DismissedSheet from '../components/DismissedSheet';

/** Preço exibido — o servidor decide o real (COSTS.SEGUNDA_CHANCE). */
const SECOND_CHANCE_COST = 15;
import { SintonizeBackground } from '../../../components/SintonizeBackground';
import ProfileCard from '../../../components/ProfileCard';
import { HeartBurst } from '../../../components/profile/HeartBurst';
import { useLike } from '../../../hooks/useLike';

const { width } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Genérico em tipo nomeado: httpsCallable< em fim de linha é
// corrompido ao colar.
interface DismissPayload {
  targetUid: string;
}

function toCardData(p: RealProfile): ProfileCardData {
  return {
    id:        p.uid,
    name:      p.name,
    age:       p.age,
    location:  `${p.city || ''}, ${p.state || ''}`,
    sintonia:  p.sintonia,
    photoURL:  p.photoURL || 'https://randomuser.me/api/portraits/lego/1.jpg',
    // Só o Turbo chega com tipo (sintonizeService) — é o selo.
    boostType: p.boostType,
    equippedFrame:       p.equippedFrame,
    equippedBadge:       p.equippedBadge,
    equippedBadgeRarity: p.equippedBadgeRarity,
    equippedTitle:       p.equippedTitle,
    prestigeStage:       p.prestigeStage,
  };
}

export default function SintonizeScreen() {
  const { user }   = useAuth();
  const navigation = useNavigation<NavProp>();
  const listRef    = useRef<FlatList<ProfileCardData>>(null);

  const [queue,    setQueue]    = useState<ProfileCardData[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [index,    setIndex]    = useState(0);
  const [finished, setFinished] = useState(false);
  // uid de quem acabou de ser curtido. A comemoração é do card
  // dele, não da tela — sem isso ela apareceria sobre o
  // próximo perfil depois do avanço.
  const [celebrating, setCelebrating] = useState<string | null>(null);

  const profileRef   = useRef<UserProfile | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const cursorRef    = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const seedRef      = useRef<number | null>(null);
  const wrappedRef   = useRef(false);
  // Trava reentrante: sem ela o onScroll pede a mesma página
  // várias vezes durante o gesto.
  const fetchingRef  = useRef(false);

  const { like } = useLike(user?.uid);
  const insets   = useSafeAreaInsets();
  const { refreshWallet } = useCoins();

  // Segunda Chance: quando cada um foi passado (uid → ms).
  const dismissedAtRef = useRef<Record<string, number>>({});
  const [dismissedCount,   setDismissedCount]   = useState(0);
  const [sheetVisible,     setSheetVisible]     = useState(false);
  const [dismissedList,    setDismissedList]    = useState<DismissedProfile[]>([]);
  const [loadingDismissed, setLoadingDismissed] = useState(false);
  const [bringingId,       setBringingId]       = useState<string | null>(null);

  const loadMore = useCallback(async (replace: boolean) => {
    const profile = profileRef.current;
    if (!profile || fetchingRef.current) return;

    fetchingRef.current = true;
    try {
      const page = await fetchSintonizePage(
        profile,
        dismissedRef.current,
        replace ? null : cursorRef.current,
        replace ? null : seedRef.current,
        replace ? false : wrappedRef.current,
      );

      cursorRef.current  = page.cursor;
      seedRef.current    = page.seed;
      wrappedRef.current = page.wrapped;

      const cards = page.profiles.map(toCardData);

      setQueue(prev => {
        if (replace) return cards;
        // Deduplica: a volta ao início pode trazer alguém que
        // já está na fila.
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...cards.filter(c => !seen.has(c.id))];
      });

      if (!page.hasMore && cards.length === 0) setFinished(true);
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    async function start() {
      if (!user?.uid) return;
      try {
        const profile = await getProfile(user.uid);
        if (!profile) return;

        profileRef.current = profile;

        const prog = (profile as { progression?: Record<string, unknown> }).progression ?? {};
        const map = activeDismissalMap(
          prog.dismissedProfiles as Record<string, unknown> | undefined,
        );
        dismissedAtRef.current = map;
        dismissedRef.current   = new Set(Object.keys(map));
        setDismissedCount(Object.keys(map).length);

        await loadMore(true);
      } finally {
        setLoading(false);
      }
    }
    start();
  }, [user?.uid]);

  /** Remove da fila e avança. Usado pela curtida e pelo descarte. */
  function advance() {
    const next = index + 1;
    if (next < queue.length) {
      listRef.current?.scrollToIndex({ index: next, animated: true });
    }
  }

  /**
   * Chamado pelo card DEPOIS que a curtida foi registrada. A
   * chamada em si é do ProfileCard, que já tem o useLike e o
   * botão — a tela só comemora e avança.
   *
   * O avanço espera a comemoração: avançar na hora cortaria os
   * corações pela metade.
   */
  function handleLiked(targetUid: string) {
    setCelebrating(targetUid);
    setTimeout(() => {
      setCelebrating(null);
      advance();
    }, 1500);
  }

  async function openDismissed() {
    const profile = profileRef.current;
    if (!profile) return;
    setSheetVisible(true);
    setLoadingDismissed(true);
    try {
      setDismissedList(await fetchDismissedProfiles(profile, dismissedAtRef.current));
    } finally {
      setLoadingDismissed(false);
    }
  }

  function confirmBringBack(p: DismissedProfile) {
    Alert.alert(
      'Segunda Chance',
      `Trazer ${p.name} de volta por ${SECOND_CHANCE_COST} cristais?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Trazer de volta', onPress: () => bringBack(p) },
      ],
    );
  }

  async function bringBack(p: DismissedProfile) {
    setBringingId(p.uid);
    try {
      await bringBackProfile(p.uid);

      delete dismissedAtRef.current[p.uid];
      dismissedRef.current.delete(p.uid);
      setDismissedCount(Object.keys(dismissedAtRef.current).length);
      setDismissedList(prev => prev.filter(x => x.uid !== p.uid));

      // Entra como o card ATUAL: é quem a pessoa quis rever.
      const card = toCardData(p);
      setQueue(prev => [
        ...prev.slice(0, index).filter(c => c.id !== card.id),
        card,
        ...prev.slice(index).filter(c => c.id !== card.id),
      ]);
      setSheetVisible(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index, animated: false });
      });

      refreshWallet();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível trazer de volta.';
      Alert.alert('Segunda Chance', message);
    } finally {
      setBringingId(null);
    }
  }

  function handleDismiss(targetUid: string) {
    dismissedRef.current.add(targetUid);
    dismissedAtRef.current[targetUid] = Date.now();
    setDismissedCount(Object.keys(dismissedAtRef.current).length);

    // Fire-and-forget: o descarte é conveniência, e falha aqui
    // só faz o perfil reaparecer numa próxima sessão.
    const fn = httpsCallable<DismissPayload, unknown>(getFunctions(), 'dismissProfile');
    fn({ targetUid }).catch(() => {});

    advance();
  }

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const current = Math.round(e.nativeEvent.contentOffset.x / width);
    if (current !== index) setIndex(current);

    // Reabastece antes de acabar: a pessoa nunca deve ver
    // carregamento entre um card e outro.
    if (queue.length - current <= REFILL_THRESHOLD && !finished) {
      loadMore(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <SintonizeBackground />
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </View>
    );
  }

  if (queue.length === 0) {
    return (
      <View style={styles.container}>
        <SintonizeBackground />
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>✦</Text>
          <Text style={styles.emptyTitle}>Por hoje é isso</Text>
          <Text style={styles.emptySub}>
            Você viu todos por aqui. Volte amanhã — quem você
            passou reaparece em 24 horas.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SintonizeBackground />

      {dismissedCount > 0 && (
        <TouchableOpacity
          style={[styles.dismissedBtn, { top: insets.top + spacing.sm }]}
          onPress={openDismissed}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Ver ${dismissedCount} perfis passados hoje`}
        >
          <Text style={styles.dismissedText}>↺ Passados hoje · {dismissedCount}</Text>
        </TouchableOpacity>
      )}

      <DismissedSheet
        visible={sheetVisible}
        loading={loadingDismissed}
        profiles={dismissedList}
        bringingId={bringingId}
        cost={SECOND_CHANCE_COST}
        onClose={() => setSheetVisible(false)}
        onBringBack={confirmBringBack}
      />

      <FlatList
        ref={listRef}
        data={queue}
        // Sem isto a FlatList não re-renderiza quando o index
        // muda, e o `animatedAura={i === index}` fica congelado
        // no valor da primeira montagem — a aura nunca anima.
        extraData={index}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        // Mantém só o necessário montado: com aura animada, um
        // card fora da tela ainda consome quadros.
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        removeClippedSubviews
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => (
          <View style={styles.page}>
            <View style={[styles.cardWrap, styles.cardScale]}>
              <ProfileCard
                data={item}
                onPress={() => navigation.navigate('RealProfile', { userId: item.id })}
                viewerUid={user?.uid}
                // Anima SÓ o card visível: os vizinhos ficam
                // montados para a rolagem ser fluida, mas
                // animar três auras ao mesmo tempo desperdiça.
                animatedAura={i === index}
                onLiked={() => handleLiked(item.id)}
              />
            </View>

            {/* FORA do cardWrap: lá dentro os corações herdavam
                a escala de 1.45 e o recorte do card, então
                nasciam no meio da foto em vez de subirem da
                base da tela. */}
            <HeartBurst
              active={celebrating === item.id}
              width={width}
              height={600}
            />

            {/* Passar vira uma seta LATERAL: os dois botões
                embaixo duplicavam o "Sintonizar" que o card já
                tem, e o de baixo não dava retorno visual —
                parecia morto mesmo funcionando.
                À direita porque o gesto de arrastar também vai
                para lá; a seta é a dica de que dá para passar. */}
            <TouchableOpacity
              style={styles.passSide}
              onPress={() => handleDismiss(item.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.passArrow}>›</Text>
              <Text style={styles.passHint}>passar</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyIcon: { fontSize: 48, color: colors.gold },
  emptyTitle:{ color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  emptySub:  { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center', lineHeight: 22 },
  // Card centralizado no espaço que sobra e os botões fixos
  // embaixo: com tudo centralizado junto, o conjunto flutuava
  // no meio e o polegar tinha que subir para agir.
  page: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl,
    // Reserva o espaço dos botões, que ficam absolutos.
    paddingBottom: 110,
  },
  cardScale: {
    // 1.45x da largura de grade. O ProfileCard foi dimensionado
    // para caber dois por linha; aqui há a tela inteira, e no
    // tamanho original ele parecia perdido no meio do universo.
    transform: [{ scale: 1.45 }],
  },
  // O card flutua: sombra forte contra o fundo escuro do
  // universo é o que dá a sensação de profundidade.
  cardWrap: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius:  20,
    elevation:     14,
  },
  passSide: {
    position: 'absolute',
    right: spacing.xs,
    // Na altura da foto, onde o polegar já está.
    top: '38%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface + '99',
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  passArrow: { color: colors.grayLight, fontSize: 30, fontWeight: 'bold', lineHeight: 32 },
  dismissedBtn: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface + 'CC',
    borderWidth: 1,
    borderColor: colors.gold + '66',
  },
  dismissedText: { color: colors.gold, fontSize: fonts.sizes.xs, fontWeight: 'bold', letterSpacing: 0.3 },
  passHint:  { color: colors.gray, fontSize: 9, letterSpacing: 0.5 },
});